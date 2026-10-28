import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSimulation, sendSms, type SendResult } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import { unsubscribeBaseUrl } from "@/lib/optOut";
import { generateUniqueCodes } from "@/lib/codes";
import { fetchAll } from "@/lib/fetchAll";
import { clientFirstName, composeCampaignMessage } from "@/lib/smsText";
import type { Recipient } from "./recipients";

// Sending a campaign, shared by the campaign page ("Enviar campanha", "Continuar envio")
// and the daily job that sends live campaigns to new clients (live.ts).

export type CampaignRow = {
  name: string;
  sms_text: string;
  vale_percent: number | null;
  vale_amount_eur: number | null;
  vale_valid_from: string | null;
  vale_valid_to: string | null;
};

// How many SMS go out at the same time, and the pause between groups:
// gentle on the SMS provider, and still quick enough for a few hundred clients
// within the page's 60-second limit.
const BATCH = 10;
const PAUSE_MS = 500;
// No new group starts after this long, so the page finishes before Vercel's
// 60-second limit (a group can take up to 20 seconds if the provider is slow).
// Whoever is left gets their SMS with "Continuar envio" on the campaign's summary.
export const TIME_BUDGET_MS = 35_000;
// Creates the missing vales (if the campaign has one) and sends to `recipients`,
// who must all be clients who receive messages with no log row for this campaign.
export async function deliver(
  supabase: SupabaseClient,
  id: string,
  row: CampaignRow,
  recipients: Recipient[],
  startedAt: number
): Promise<{ message: string } | { error: string; nothingSent: boolean }> {
  // A vale only for the clients whose number can receive the SMS. Vales created by
  // an earlier, interrupted run are reused.
  const valeByClient = new Map<string, string>();
  if (row.vale_valid_from && row.vale_valid_to) {
    let created: { client_id: string | null; code: string }[];
    try {
      created = await fetchAll<{ client_id: string | null; code: string }>((from, to) =>
        supabase.from("discount_codes").select("client_id, code").eq("campaign_id", id).order("id").range(from, to)
      );
    } catch {
      return { error: "Não foi possível ler os vales da campanha, por isso nada foi enviado. Tente novamente.", nothingSent: true };
    }
    for (const v of created) if (v.client_id && !valeByClient.has(v.client_id)) valeByClient.set(v.client_id, v.code);

    const needVale = recipients.filter((c) => normalizePhone(c.phone).ok && !valeByClient.has(c.id));
    let codes: string[];
    try {
      codes = await generateUniqueCodes(supabase, needVale.length);
    } catch {
      return { error: "Não foi possível criar os vales, por isso nada foi enviado. Tente novamente.", nothingSent: true };
    }
    const vales = needVale.map((c, i) => ({
      code: codes[i],
      kind: "manual",
      percent: row.vale_percent,
      amount_eur: row.vale_amount_eur,
      note: `Campanha: ${row.name}`.slice(0, 80),
      client_id: c.id,
      campaign_id: id,
      valid_from: row.vale_valid_from,
      valid_to: row.vale_valid_to,
    }));
    for (let i = 0; i < vales.length; i += 500) {
      const chunk = vales.slice(i, i + 500);
      const { error: valeError } = await supabase.from("discount_codes").insert(chunk);
      if (valeError) {
        return i === 0 && created.length === 0
          ? { error: "Não foi possível criar os vales, por isso nada foi enviado. Tente novamente.", nothingSent: true }
          : {
              error: `Só foram criados ${i} de ${vales.length} vales e nenhum SMS foi enviado. Carregue em “Continuar envio” para tentar de novo.`,
              nothingSent: false,
            };
      }
      for (const v of chunk) valeByClient.set(v.client_id, v.code);
    }
  }

  const appUrl = unsubscribeBaseUrl();
  const counts = { ok: 0, failed: 0, skipped: 0 };
  let reached = 0;
  for (let i = 0; i < recipients.length; i += BATCH) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS));
    const group = recipients.slice(i, i + BATCH);
    const results: SendResult[] = await Promise.all(
      group.map((c) =>
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
    reached += group.length;
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
  const left = recipients.length - reached;
  if (left > 0) {
    parts.push(
      `Ainda ${left === 1 ? "falta 1 cliente" : `faltam ${left} clientes`}: daqui a um minuto, carregue em “Continuar envio”.`
    );
  }
  return { message: parts.join(" ") };
}
