"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSimulation, sendSms } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import { appUrlError, unsubscribeBaseUrl } from "@/lib/optOut";
import { randomString } from "@/lib/codes";
import { pendingRecipients, RESUME_AFTER_MS, type Recipient } from "./recipients";
import { deliver, type CampaignRow } from "./deliver";
import { INVALID_DATE, parseDisplayDate } from "@/lib/date";
import { composeCampaignMessage } from "@/lib/smsText";

export type CampaignField = "name" | "sms_text" | "value" | "valid_from" | "valid_to" | "phone";

// `intent` says which button was pressed, so its result shows next to it.
// `savedId`: a new campaign was saved as a draft before sending failed, so the next try updates it.
export type CampaignState = { error?: string; field?: CampaignField; ok?: string; intent?: Intent; savedId?: string };

type Intent = "save" | "test" | "send";


// Shown in a test SMS instead of a real vale code. It has a "1", which real codes
// never have, so it can never match a real vale.
const TEST_VALE = "TESTE123";

function parse(formData: FormData): { error: string; field?: CampaignField } | { row: CampaignRow } {
  const name = String(formData.get("name") ?? "").trim();
  const smsText = String(formData.get("sms_text") ?? "").trim();
  const withVale = formData.get("with_vale") === "on";

  if (!name) return { error: "Escreva o nome da campanha.", field: "name" };
  if (!smsText) return { error: "Escreva a mensagem.", field: "sms_text" };

  if (!withVale) {
    if (smsText.includes("{vale}")) {
      return { error: "Tire {vale} da mensagem, ou marque “Incluir um vale para cada cliente”.", field: "sms_text" };
    }
    return {
      row: { name, sms_text: smsText, vale_percent: null, vale_amount_eur: null, vale_valid_from: null, vale_valid_to: null },
    };
  }

  const discountType = String(formData.get("discount_type") ?? "");
  const valueRaw = String(formData.get("value") ?? "").trim();
  const value = Number(valueRaw.replace(",", "."));
  const validFrom = parseDisplayDate(String(formData.get("valid_from") ?? ""));
  const validTo = parseDisplayDate(String(formData.get("valid_to") ?? ""));

  if (!smsText.includes("{vale}")) {
    return { error: "A mensagem tem de incluir {vale}, para o cliente receber o código do vale.", field: "sms_text" };
  }
  if (discountType !== "percent" && discountType !== "amount") {
    return { error: "Escolha se o vale é uma percentagem ou um valor em euros." };
  }
  if (discountType === "percent" && (!valueRaw || !Number.isFinite(value) || value < 1 || value > 100)) {
    return {
      error: valueRaw ? "A percentagem tem de ser um número de 1 a 100." : "Escreva a percentagem de desconto.",
      field: "value",
    };
  }
  if (discountType === "amount" && (!valueRaw || !Number.isFinite(value) || value <= 0 || value > 10000)) {
    return {
      error: valueRaw ? "O valor tem de ser um número maior que zero." : "Escreva o valor do desconto em euros.",
      field: "value",
    };
  }
  if (!validFrom) return { error: INVALID_DATE, field: "valid_from" };
  if (!validTo) return { error: INVALID_DATE, field: "valid_to" };
  if (validFrom > validTo) {
    return { error: "A data “Válido até” tem de ser igual ou depois de “Válido a partir de”.", field: "valid_to" };
  }

  return {
    row: {
      name,
      sms_text: smsText,
      vale_percent: discountType === "percent" ? value : null,
      vale_amount_eur: discountType === "amount" ? Math.round(value * 100) / 100 : null,
      vale_valid_from: validFrom,
      vale_valid_to: validTo,
    },
  };
}

// Creates the campaign, or updates it while it's still a draft. Returns its id.
async function saveDraft(supabase: SupabaseClient, id: string, row: CampaignRow): Promise<string | null> {
  if (id) {
    const { data } = await supabase.from("campaigns").update(row).eq("id", id).eq("status", "draft").select("id");
    return data?.[0]?.id ?? null;
  }
  const { data } = await supabase.from("campaigns").insert(row).select("id").single();
  return data?.id ?? null;
}

// Every button on the campaign page goes through here; `intent` says which one.
export async function campaignAction(_prev: CampaignState, formData: FormData): Promise<CampaignState> {
  const intent = String(formData.get("intent") ?? "") as Intent;
  if (intent === "test") return sendTest(formData);
  if (intent !== "save" && intent !== "send") return { error: "Atualize a página e tente novamente." };

  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error, field: parsed.field, intent };

  const supabase = await createClient();
  const id = await saveDraft(supabase, String(formData.get("id") ?? ""), parsed.row);
  if (!id) {
    return {
      error: "Não foi possível guardar a campanha. Se já foi enviada, veja-a na lista de campanhas; senão, tente novamente.",
      intent,
    };
  }

  if (intent === "save") redirect(`/campaigns?saved=${id}&message=${encodeURIComponent("Campanha guardada.")}`);

  const result = await sendToAll(supabase, id, parsed.row);
  if ("error" in result) return { error: result.error, intent, savedId: id };
  redirect(`/campaigns/${id}?message=${encodeURIComponent(result.message)}`);
}

async function sendTest(formData: FormData): Promise<CampaignState> {
  const intent = "test";
  const phone = String(formData.get("phone") ?? "").trim();
  const smsText = String(formData.get("sms_text") ?? "").trim();
  const id = String(formData.get("id") ?? "");

  if (!smsText) return { error: "Escreva a mensagem.", field: "sms_text", intent };
  if (!phone) return { error: "Escreva o número de telefone para o teste.", field: "phone", intent };
  if (!normalizePhone(phone).ok) {
    return {
      error: "O telemóvel tem de ter 9 dígitos e começar por 9 (ou começar por +, se for estrangeiro).",
      field: "phone",
      intent,
    };
  }

  const urlError = appUrlError();
  if (urlError) return { error: urlError, intent };

  // Not a real client's token: the link in a test SMS opens "Link inválido".
  const testToken = randomString("abcdefghijklmnopqrstuvwxyz0123456789", 8);
  const text = composeCampaignMessage(smsText, { firstName: "Teste", vale: TEST_VALE }, unsubscribeBaseUrl(), testToken);

  const result = await sendSms(phone, text, { isTest: true, campaignId: id || undefined });
  if (!result.ok) return { error: result.error ?? "Não foi possível enviar o SMS de teste. Tente novamente.", intent };
  return {
    ok: isSimulation()
      ? "SMS de teste simulado: ficou só no histórico de envios, nada foi enviado de verdade."
      : "SMS de teste enviado.",
    intent,
  };
}

async function sendToAll(
  supabase: SupabaseClient,
  id: string,
  row: CampaignRow
): Promise<{ message: string } | { error: string }> {
  const startedAt = Date.now();
  const urlError = appUrlError();
  if (urlError) return { error: urlError };
  // Only clients who want to receive messages, never anyone else (1,000 at a time).
  let recipients: Recipient[];
  try {
    recipients = await pendingRecipients(supabase, id);
  } catch {
    return { error: "Não foi possível ler a lista de clientes. Tente novamente." };
  }
  if (recipients.length === 0) return { error: "Nenhum cliente quer receber mensagens. Nada foi enviado." };

  // Mark it as sent first, so a double tap (or a second tab) can never send it twice.
  const { data: claimed } = await supabase
    .from("campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (!claimed?.length) return { error: "Esta campanha já foi enviada. Veja o resumo na lista de campanhas." };

  const result = await deliver(supabase, id, row, recipients, startedAt);
  if ("error" in result && result.nothingSent) {
    // Nothing was created or sent: put the campaign back to draft so it can be tried again.
    await supabase.from("campaigns").update({ status: "draft", sent_at: null }).eq("id", id);
  }
  return result;
}

// "Continuar envio" on a sent campaign's summary: sends only to the clients who
// receive messages and have nothing in the log for it yet.
export async function resumeCampaign(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const seenSentAt = String(formData.get("sent_at") ?? "");
  const back = (message: string) => redirect(`/campaigns/${id}?message=${encodeURIComponent(message)}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/campaigns");
  const startedAt = Date.now();
  const urlError = appUrlError();
  if (urlError) back(urlError);

  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("name, sms_text, status, sent_at, vale_percent, vale_amount_eur, vale_valid_from, vale_valid_to")
    .eq("id", id)
    .maybeSingle();
  if (!campaign || campaign.status !== "sent" || !campaign.sent_at) back("Esta campanha ainda não foi enviada.");
  if (Date.now() - new Date(campaign!.sent_at).getTime() < RESUME_AFTER_MS) {
    back("O envio ainda pode estar a decorrer. Espere um minuto, atualize a página e veja se ainda falta alguém.");
  }

  // Only one run at a time: this moves sent_at forward only if nobody else did since
  // the page was opened, so a double tap or a second tab gets nothing.
  const { data: claimed } = await supabase
    .from("campaigns")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "sent")
    .eq("sent_at", seenSentAt)
    .select("id");
  if (!claimed?.length) back("O envio já foi continuado noutra janela. Atualize a página para ver o resumo.");

  let recipients: Recipient[];
  try {
    recipients = await pendingRecipients(supabase, id);
  } catch {
    back("Não foi possível ler a lista de clientes. Tente novamente.");
    return;
  }
  if (recipients.length === 0) back("Já não falta ninguém: todos os clientes que recebem mensagens estão no histórico.");

  const result = await deliver(supabase, id, campaign as CampaignRow, recipients, startedAt);
  back("error" in result ? result.error : result.message);
}
