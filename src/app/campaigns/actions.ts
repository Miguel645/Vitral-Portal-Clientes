"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSimulation, sendSms } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import { appUrlError, unsubscribeBaseUrl } from "@/lib/optOut";
import { randomString } from "@/lib/codes";
import { pendingRecipients } from "./recipients";
import { runCampaignStep, type CampaignRow } from "./deliver";
import { formatDate, INVALID_DATE, lisbonToday, parseDisplayDate } from "@/lib/date";
import { composeCampaignMessage } from "@/lib/smsText";

export type CampaignField = "name" | "sms_text" | "value" | "valid_from" | "valid_to" | "starts_on" | "live_until" | "phone";

// `intent` says which button was pressed, so its result shows next to it.
// `savedId`: a new campaign was saved as a draft before sending failed, so the next try updates it.
export type CampaignState = { error?: string; field?: CampaignField; ok?: string; intent?: Intent; savedId?: string };

type Intent = "save" | "test" | "send";

// What's saved: the message and vale, plus "Início" (sent that day, at 10:00 when it's
// later than today) and "Fim" (until then, the 10:00 job finishes a send that stopped
// half-way).
type SavedRow = CampaignRow & { starts_on: string; live_until: string };


// Shown in a test SMS instead of a real vale code. It has a "1", which real codes
// never have, so it can never match a real vale.
const TEST_VALE = "TESTE123";

function parse(formData: FormData): { error: string; field?: CampaignField } | { row: SavedRow } {
  const parsed = parseMessage(formData);
  if ("error" in parsed) return parsed;
  const { row } = parsed;

  const startsOn = parseDisplayDate(String(formData.get("starts_on") ?? ""));
  const liveUntil = parseDisplayDate(String(formData.get("live_until") ?? ""));
  if (!startsOn) return { error: INVALID_DATE, field: "starts_on" };
  if (startsOn < lisbonToday()) return { error: "O início tem de ser hoje ou depois.", field: "starts_on" };
  if (!liveUntil) return { error: INVALID_DATE, field: "live_until" };
  if (liveUntil < startsOn) return { error: "O fim tem de ser igual ou depois do início.", field: "live_until" };
  if (row.vale_valid_to && liveUntil > row.vale_valid_to) {
    return { error: "O fim não pode ser depois de “Válido até” do vale: quem a recebesse no fim receberia um vale já expirado.", field: "live_until" };
  }
  return { row: { ...row, starts_on: startsOn, live_until: liveUntil } };
}

function parseMessage(formData: FormData): { error: string; field?: CampaignField } | { row: CampaignRow } {
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

// Creates the campaign, or updates it while it's still a draft or scheduled (saving a
// scheduled one as a draft cancels the schedule). Returns its id.
async function saveCampaign(
  supabase: SupabaseClient,
  id: string,
  row: SavedRow,
  status: "draft" | "scheduled"
): Promise<string | null> {
  if (id) {
    const { data } = await supabase
      .from("campaigns")
      .update({ ...row, status })
      .eq("id", id)
      .in("status", ["draft", "scheduled"])
      .select("id");
    return data?.[0]?.id ?? null;
  }
  const { data } = await supabase.from("campaigns").insert({ ...row, status }).select("id").single();
  return data?.id ?? null;
}

// Every button on the campaign page goes through here; `intent` says which one.
export async function campaignAction(_prev: CampaignState, formData: FormData): Promise<CampaignState> {
  const intent = String(formData.get("intent") ?? "") as Intent;
  if (intent === "test") return sendTest(formData);
  if (intent !== "save" && intent !== "send") return { error: "Atualize a página e tente novamente." };

  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error, field: parsed.field, intent };

  // Starting later: saved as scheduled, and the daily job sends it at 10:00 on its start date.
  const later = intent === "send" && parsed.row.starts_on > lisbonToday();
  const supabase = await createClient();
  const id = await saveCampaign(supabase, String(formData.get("id") ?? ""), parsed.row, later ? "scheduled" : "draft");
  if (!id) {
    return {
      error: "Não foi possível guardar a campanha. Se já foi enviada, veja-a na lista de campanhas; senão, tente novamente.",
      intent,
    };
  }

  if (intent === "save") redirect(`/campaigns?saved=${id}&message=${encodeURIComponent("Campanha guardada.")}`);
  if (later) {
    const message = `Campanha agendada: vai ser enviada a ${formatDate(parsed.row.starts_on)}, às 10h.`;
    redirect(`/campaigns?saved=${id}&message=${encodeURIComponent(message)}`);
  }

  const result = await sendToAll(supabase, id);
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

// How long "Enviar campanha" sends while the page waits; whoever is left gets it from
// background steps, by themselves (src/lib/jobs).
const FIRST_STEP_MS = 10_000;

async function sendToAll(
  supabase: SupabaseClient,
  id: string
): Promise<{ message: string } | { error: string }> {
  // Taken before the client list is read: clients added, or who switch messages on,
  // after this never get it.
  const firstSentAt = new Date().toISOString();
  const urlError = appUrlError();
  if (urlError) return { error: urlError };
  let count: number;
  try {
    count = (await pendingRecipients(supabase, id, { cutoff: firstSentAt })).length;
  } catch {
    return { error: "Não foi possível ler a lista de clientes. Tente novamente." };
  }
  if (count === 0) return { error: "Nenhum cliente quer receber mensagens. Nada foi enviado." };

  // Mark it as sent first, so a double tap (or a second tab) can never send it twice.
  const { data: claimed } = await supabase
    .from("campaigns")
    .update({ status: "sent", sent_at: firstSentAt, first_sent_at: firstSentAt })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (!claimed?.length) return { error: "Esta campanha já foi enviada. Veja o resumo na lista de campanhas." };

  const result = await runCampaignStep(supabase, id, Date.now() + FIRST_STEP_MS);
  if (result.status === "error" && result.nothingSent) {
    // Nothing was created or sent: put the campaign back to draft so it can be tried again.
    await supabase.from("campaigns").update({ status: "draft", sent_at: null, first_sent_at: null, send_error: null }).eq("id", id);
    return { error: `${result.error} Tente novamente.` };
  }
  return { message: stepMessage(result) };
}

// What "Enviar campanha" says once its first step is done.
function stepMessage(result: Awaited<ReturnType<typeof runCampaignStep>>): string {
  if (result.status === "error") {
    return `${result.error} A campanha volta a tentar sozinha; o resumo mostra o que foi enviado.`;
  }
  if (result.status !== "done") return "Campanha enviada.";
  const simulated = isSimulation();
  const parts = [
    simulated
      ? `Campanha enviada em modo simulação: ${result.ok} SMS simulados, nada foi enviado de verdade.`
      : `Campanha enviada: ${result.ok} SMS enviados.`,
  ];
  if (result.failed > 0) parts.push(`${result.failed} falharam.`);
  if (result.skipped > 0) parts.push(`${result.skipped} ignorados (número inválido).`);
  if (result.left > 0) {
    parts.push(`Os outros ${result.left} estão a ser enviados automaticamente — pode fechar esta página.`);
  }
  return parts.join(" ");
}

// "Parar campanha" on a live campaign's summary: the daily job no longer finishes its send.
export async function stopCampaign(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/campaigns");
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .update({ stopped_at: new Date().toISOString() })
    .eq("id", id)
    .is("stopped_at", null)
    .select("id");
  const message = data?.length
    ? "Campanha parada: já não é enviada a mais ninguém."
    : "Não foi possível parar a campanha. Atualize a página e tente novamente.";
  redirect(`/campaigns/${id}?message=${encodeURIComponent(message)}`);
}

// "Eliminar campanha" in the campaign's "…" menu. The SMS history and the vales it
// created stay, without the campaign; a live or scheduled campaign stops going out.
export async function deleteCampaign(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const supabase = await createClient();
    await supabase.from("campaigns").delete().eq("id", id);
  }
  redirect(`/campaigns?message=${encodeURIComponent(name ? `Campanha ${name} eliminada.` : "Campanha eliminada.")}`);
}
