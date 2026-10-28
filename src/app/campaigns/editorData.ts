import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { clientFirstName } from "@/lib/smsText";
import { unsubscribeBaseUrl } from "@/lib/optOut";
import { addDays, lisbonToday } from "@/lib/date";

// What CampaignEditor needs besides the campaign itself.
export async function loadEditorData() {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name, phone, short_token").eq("consent", true).order("name");
  const clients = (data ?? []).map((c) => ({ ...c, valid: normalizePhone(c.phone).ok }));
  const first = clients.find((c) => c.valid);
  const today = lisbonToday();

  return {
    recipients: clients.map((c) => ({ firstName: clientFirstName(c.name), valid: c.valid })),
    previewClient: first ? { name: first.name, firstName: clientFirstName(first.name), token: first.short_token } : null,
    appUrl: unsubscribeBaseUrl(),
    testPhone: process.env.TEST_PHONE_NUMBER ?? "",
    today,
    defaultValidTo: addDays(today, 30),
  };
}
