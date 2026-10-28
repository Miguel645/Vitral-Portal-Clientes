import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";
import { consentedByFirstSend } from "./audience";

// "Continuar envio" only once an earlier run has certainly stopped.
export const RESUME_AFTER_MS = 90_000;

export type Recipient = { id: string; name: string; phone: string; short_token: string };

// Clients who receive messages and have no sms_log row for this campaign yet (tests
// don't count). Used before sending and on the summary page.
// A client only gets a campaign if they were added before it went out on its "Início"
// (owner decision, 2026-10-28): clients added after the first send are always left out.
// The cut-off is the campaign's first_sent_at; `cutoff` gives it for a send that's
// starting now (first_sent_at not saved yet). `finishing` (the daily job finishing a
// send) also leaves out clients who only switched messages on after the first send
// (see consentedByFirstSend).
export async function pendingRecipients(
  supabase: SupabaseClient,
  campaignId: string,
  opts: { cutoff?: string; finishing?: boolean } = {}
): Promise<Recipient[]> {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("first_sent_at")
    .eq("id", campaignId)
    .maybeSingle<{ first_sent_at: string | null }>();
  if (error) throw error;
  if (!campaign) return [];
  const firstSentAt = campaign.first_sent_at;
  const cutoff = opts.cutoff ?? firstSentAt ?? new Date().toISOString();

  type Row = Recipient & { consent_at: string | null };
  const [clients, logged] = await Promise.all([
    fetchAll<Row>((from, to) =>
      supabase
        .from("clients")
        .select("id, name, phone, short_token, consent_at")
        .eq("consent", true)
        .lt("created_at", cutoff)
        .order("id")
        .range(from, to)
    ),
    fetchAll<{ client_id: string | null }>((from, to) =>
      supabase
        .from("sms_log")
        .select("client_id")
        .eq("campaign_id", campaignId)
        .eq("is_test", false)
        .order("id")
        .range(from, to)
    ),
  ]);
  const done = new Set(logged.map((r) => r.client_id));
  return clients
    .filter((c) => !done.has(c.id) && (!opts.finishing || !firstSentAt || consentedByFirstSend(c, firstSentAt)))
    .map(({ id, name, phone, short_token }) => ({ id, name, phone, short_token }));
}
