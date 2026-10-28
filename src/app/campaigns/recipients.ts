import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/fetchAll";

// "Continuar envio" only once an earlier run has certainly stopped.
export const RESUME_AFTER_MS = 90_000;

export type Recipient = { id: string; name: string; phone: string; short_token: string };

// Clients who receive messages and have no sms_log row for this campaign yet (tests
// don't count). Used before sending and on the summary page. `createdAfter` keeps only
// clients added after that moment (the daily job for live campaigns: new clients only).
export async function pendingRecipients(
  supabase: SupabaseClient,
  campaignId: string,
  createdAfter?: string
): Promise<Recipient[]> {
  const [recipients, logged] = await Promise.all([
    fetchAll<Recipient>((from, to) => {
      let query = supabase.from("clients").select("id, name, phone, short_token").eq("consent", true);
      if (createdAfter) query = query.gt("created_at", createdAfter);
      return query.order("id").range(from, to);
    }),
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
  return recipients.filter((c) => !done.has(c.id));
}
