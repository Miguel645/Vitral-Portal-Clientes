import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { normalizePhone } from "@/lib/phone";
import { clientFirstName } from "@/lib/smsText";
import { previewBaseUrl } from "@/lib/optOut";
import { addDays, lisbonToday } from "@/lib/date";

// What CampaignEditor needs besides the campaign itself.
export async function loadEditorData() {
  const supabase = await createClient();
  // Every client who receives messages, 1,000 at a time (for the totals before sending).
  const data = await fetchAll<{ name: string; phone: string; short_token: string }>((from, to) =>
    supabase.from("clients").select("name, phone, short_token").eq("consent", true).order("name").order("id").range(from, to)
  );
  const clients = data.map((c) => ({ ...c, valid: normalizePhone(c.phone).ok }));
  const first = clients.find((c) => c.valid);
  const today = lisbonToday();

  return {
    recipients: clients.map((c) => ({ firstName: clientFirstName(c.name), valid: c.valid })),
    previewClient: first ? { name: first.name, firstName: clientFirstName(first.name), token: first.short_token } : null,
    appUrl: previewBaseUrl(),
    testPhone: process.env.TEST_PHONE_NUMBER ?? "",
    today,
    defaultValidTo: addDays(today, 30),
  };
}
