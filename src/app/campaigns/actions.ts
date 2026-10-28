"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSimulation, sendSms, type SendResult } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import { unsubscribeBaseUrl } from "@/lib/optOut";
import { generateUniqueCodes } from "@/lib/codes";
import { INVALID_DATE, parseDisplayDate } from "@/lib/date";
import { clientFirstName, composeCampaignMessage } from "@/lib/smsText";

export type CampaignField = "name" | "sms_text" | "value" | "valid_from" | "valid_to" | "phone";

// `intent` says which button was pressed, so its result shows next to it.
// `savedId`: a new campaign was saved as a draft before sending failed, so the next try updates it.
export type CampaignState = { error?: string; field?: CampaignField; ok?: string; intent?: Intent; savedId?: string };

type Intent = "save" | "test" | "send";

type CampaignRow = {
  name: string;
  sms_text: string;
  vale_percent: number | null;
  vale_amount_eur: number | null;
  vale_valid_from: string | null;
  vale_valid_to: string | null;
};

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

  if (intent === "save") redirect(`/campaigns/${id}?message=${encodeURIComponent("Campanha guardada.")}`);

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

  // Not a real client's token: the link in a test SMS opens "Link inválido".
  const testToken = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
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

// How many SMS go out at the same time, and the pause between groups:
// gentle on Twilio, and still quick enough for a few hundred clients within the
// page's 60-second limit.
const BATCH = 10;
const PAUSE_MS = 500;

async function sendToAll(
  supabase: SupabaseClient,
  id: string,
  row: CampaignRow
): Promise<{ message: string } | { error: string }> {
  // Only clients who want to receive messages, never anyone else.
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, phone, short_token")
    .eq("consent", true)
    .order("name");
  if (error) return { error: "Não foi possível ler a lista de clientes. Tente novamente." };
  const recipients = data ?? [];
  if (recipients.length === 0) return { error: "Nenhum cliente quer receber mensagens. Nada foi enviado." };

  // Mark it as sent first, so a double tap (or a second tab) can never send it twice.
  const { data: claimed } = await supabase
    .from("campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (!claimed?.length) return { error: "Esta campanha já foi enviada. Veja o resumo na lista de campanhas." };

  // A vale only for the clients whose number can receive the SMS.
  const valeByClient = new Map<string, string>();
  if (row.vale_valid_from && row.vale_valid_to) {
    const withPhone = recipients.filter((c) => normalizePhone(c.phone).ok);
    let codes: string[];
    try {
      codes = await generateUniqueCodes(supabase, withPhone.length);
    } catch {
      await supabase.from("campaigns").update({ status: "draft", sent_at: null }).eq("id", id);
      return { error: "Não foi possível criar os vales, por isso nada foi enviado. Tente novamente." };
    }
    const vales = withPhone.map((c, i) => {
      valeByClient.set(c.id, codes[i]);
      return {
        code: codes[i],
        kind: "manual",
        percent: row.vale_percent,
        amount_eur: row.vale_amount_eur,
        note: `Campanha: ${row.name}`.slice(0, 80),
        client_id: c.id,
        campaign_id: id,
        valid_from: row.vale_valid_from,
        valid_to: row.vale_valid_to,
      };
    });
    for (let i = 0; i < vales.length; i += 500) {
      const { error: valeError } = await supabase.from("discount_codes").insert(vales.slice(i, i + 500));
      if (valeError) {
        if (i === 0) {
          // Nothing was created or sent: put the campaign back to draft so it can be tried again.
          await supabase.from("campaigns").update({ status: "draft", sent_at: null }).eq("id", id);
          return { error: "Não foi possível criar os vales, por isso nada foi enviado. Tente novamente." };
        }
        return {
          error: `Só foram criados ${i} de ${vales.length} vales e nenhum SMS foi enviado. Veja a lista de vales antes de continuar.`,
        };
      }
    }
  }

  const appUrl = unsubscribeBaseUrl();
  const counts = { ok: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < recipients.length; i += BATCH) {
    if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
    const results: SendResult[] = await Promise.all(
      recipients.slice(i, i + BATCH).map((c) =>
        sendSms(
          c.phone,
          composeCampaignMessage(
            row.sms_text,
            { firstName: clientFirstName(c.name), vale: valeByClient.get(c.id) ?? "" },
            appUrl,
            c.short_token
          ),
          { clientId: c.id, campaignId: id, db: supabase }
        )
      )
    );
    for (const r of results) {
      if (r.ok) counts.ok++;
      else if (r.status === "skipped") counts.skipped++;
      else counts.failed++;
    }
  }

  const parts = [
    isSimulation()
      ? `Campanha enviada em modo simulação: ${counts.ok} SMS simulados, nada foi enviado de verdade.`
      : `Campanha enviada: ${counts.ok} SMS enviados.`,
  ];
  if (counts.failed > 0) parts.push(`${counts.failed} falharam.`);
  if (counts.skipped > 0) parts.push(`${counts.skipped} ignorados (número inválido).`);
  return { message: parts.join(" ") };
}
