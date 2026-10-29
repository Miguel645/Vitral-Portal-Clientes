import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";
import { consentedByFirstSend } from "./audience";

export type Recipient = { id: string; name: string; phone: string; short_token: string };

// Clients who still have to get this campaign: they receive messages, have no sms_log row
// for it yet (tests don't count), and already existed and received messages when it went
// out on its "Início" (owner decision, 2026-10-28) — clients added, or who switched
// messages on, after that never get it. Used by every send step and by the summary.
// The cut-off is the campaign's first_sent_at; `cutoff` gives it for a send that's
// starting now (first_sent_at not saved yet).
export async function pendingRecipients(
  supabase: SupabaseClient,
  campaignId: string,
  opts: { cutoff?: string } = {}
): Promise<Recipient[]> {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("first_sent_at")
    .eq("id", campaignId)
    .maybeSingle<{ first_sent_at: string | null }>();
  if (error) throw error;
  if (!campaign) return [];
  const cutoff = opts.cutoff ?? campaign.first_sent_at ?? new Date().toISOString();

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
    .filter((c) => !done.has(c.id) && consentedByFirstSend(c, cutoff))
    .map(({ id, name, phone, short_token }) => ({ id, name, phone, short_token }));
}
