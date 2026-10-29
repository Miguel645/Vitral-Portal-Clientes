import "server-only";
import { createAdminClient } from "./supabase/admin";
import { generateUniqueCode } from "./codes";
import { fetchAll } from "./fetchAll";
import { lisbonToday, addDays, formatDate } from "./date";
import { birthdayToGive } from "./birthday";
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
  const appUrl = unsubscribeBaseUrl();

  const { data: settings } = await supabase
    .from("birthday_settings")
    .select("active, percent, valid_days")
    .eq("id", 1)
    .maybeSingle();

  if (!settings || !settings.active) return { created: 0, smsSent: 0, smsFailed: 0 };

  type Client = {
    id: string;
    name: string;
    phone: string;
    consent: boolean;
    birth_date: string | null;
    short_token: string;
    created_at: string;
    consent_at: string | null;
  };
  const clients = await fetchAll<Client>((from, to) =>
    supabase
      .from("clients")
      .select("id, name, phone, consent, birth_date, short_token, created_at, consent_at")
      .eq("consent", true)
      .not("birth_date", "is", null)
      .order("id")
      .range(from, to)
  );

  let created = 0;
  let smsSent = 0;
  let smsFailed = 0;

  for (const client of clients) {
    // Today's birthday, or one from the last 7 days if a run was missed.
    const birthday = birthdayToGive(client, today);
    if (!birthday) continue;

    // Used vales are deleted, so this table (filled by a database trigger) remembers
    // which clients already got their birthday vale each year.
    const { data: existing } = await supabase
      .from("birthday_vales_given")
      .select("client_id")
      .eq("client_id", client.id)
      .eq("year", Number(birthday.slice(0, 4)))
      .limit(1);

    if (existing && existing.length > 0) continue;

    const code = await generateUniqueCode(supabase);
    // Valid from the birthday itself: the database counts one birthday vale per year by
    // this date, so a 31 December birthday caught up on 2 January still counts for its
    // own year. It lasts the full number of days from today.
    const validTo = addDays(today, settings.valid_days);
    const { error } = await supabase.from("discount_codes").insert({
      code,
      kind: "birthday",
      percent: settings.percent,
      client_id: client.id,
      valid_from: birthday,
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
