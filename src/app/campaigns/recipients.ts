import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";
import { inLiveAudience } from "./audience";

// "Continuar envio" only once an earlier run has certainly stopped.
export const RESUME_AFTER_MS = 90_000;

export type Recipient = { id: string; name: string; phone: string; short_token: string };

// Clients who receive messages and have no sms_log row for this campaign yet (tests
// don't count). Used before sending and on the summary page.
// `firstSentAt` (the daily job for live campaigns) leaves out older clients who only
// switched messages on after the campaign was first sent (see inLiveAudience).
export async function pendingRecipients(
  supabase: SupabaseClient,
  campaignId: string,
  firstSentAt?: string
): Promise<Recipient[]> {
  type Row = Recipient & { created_at: string; consent_at: string | null };
  const [clients, logged] = await Promise.all([
    fetchAll<Row>((from, to) =>
      supabase
        .from("clients")
        .select("id, name, phone, short_token, created_at, consent_at")
        .eq("consent", true)
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
    .filter((c) => !done.has(c.id) && (!firstSentAt || inLiveAudience(c, firstSentAt)))
    .map(({ id, name, phone, short_token }) => ({ id, name, phone, short_token }));
}
