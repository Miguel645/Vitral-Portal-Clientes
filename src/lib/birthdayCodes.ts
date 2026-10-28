import { createAdminClient } from "./supabase/admin";
import { generateUniqueCode } from "./codes";
import { fetchAll } from "./fetchAll";
import { lisbonToday, addDays, formatDate, isBirthdayOn } from "./date";
import { formatDiscount } from "./discount";
import { sendSms } from "./messaging";
import { clientFirstName, composeValeMessage } from "./smsText";
import { appUrlError, unsubscribeBaseUrl } from "./optOut";

// No accents outside the cheap GSM-7 set (é is fine), so it stays a 160-character SMS.
export const BIRTHDAY_SMS_TEMPLATE =
  "Parabéns {{name}}! A Vitral oferece-lhe {{desconto}} de desconto: {{codigo}}. Use-o até {{validade}}.";

export async function runBirthdayCheck(): Promise<{ created: number; smsSent: number; smsFailed: number; error?: string }> {
  // Stop before creating anything: each birthday vale gets its one SMS right away,
  // and it would carry a broken unsubscribe link.
  const urlError = appUrlError();
  if (urlError) return { created: 0, smsSent: 0, smsFailed: 0, error: urlError };

  const supabase = createAdminClient();
  const today = lisbonToday();
  const todayY = Number(today.slice(0, 4));
  const appUrl = unsubscribeBaseUrl();

  const { data: settings } = await supabase
    .from("birthday_settings")
    .select("active, percent, valid_days")
    .eq("id", 1)
    .maybeSingle();

  if (!settings || !settings.active) return { created: 0, smsSent: 0, smsFailed: 0 };

  type Client = { id: string; name: string; phone: string; consent: boolean; birth_date: string | null; short_token: string };
  const clients = await fetchAll<Client>((from, to) =>
    supabase
      .from("clients")
      .select("id, name, phone, consent, birth_date, short_token")
      .eq("consent", true)
      .not("birth_date", "is", null)
      .order("id")
      .range(from, to)
  );

  let created = 0;
  let smsSent = 0;
  let smsFailed = 0;

  for (const client of clients) {
    if (!client.birth_date || !isBirthdayOn(client.birth_date, today)) continue;

    const { data: existing } = await supabase
      .from("discount_codes")
      .select("id")
      .eq("client_id", client.id)
      .eq("kind", "birthday")
      .gte("valid_from", `${todayY}-01-01`)
      .lte("valid_from", `${todayY}-12-31`)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const code = await generateUniqueCode(supabase);
    const validTo = addDays(today, settings.valid_days);
    const { error } = await supabase.from("discount_codes").insert({
      code,
      kind: "birthday",
      percent: settings.percent,
      client_id: client.id,
      valid_from: today,
      valid_to: validTo,
    });

    // The SMS only goes out for a vale this run actually created. The database allows
    // one birthday vale per client per year, so a second run can't create another
    // one and never sends twice.
    if (error) continue;
    created++;

    if (!client.consent || !client.phone) continue;
    const text = composeValeMessage(
      BIRTHDAY_SMS_TEMPLATE,
      {
        firstName: clientFirstName(client.name),
        codes: [code],
        discount: formatDiscount({ percent: settings.percent, amount_eur: null }),
        validTo: formatDate(validTo),
      },
      appUrl,
      client.short_token
    );
    const result = await sendSms(client.phone, text, { clientId: client.id, db: supabase });
    if (result.ok) smsSent++;
    else smsFailed++;
  }

  return { created, smsSent, smsFailed };
}
