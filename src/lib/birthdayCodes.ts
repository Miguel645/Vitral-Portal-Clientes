import { createAdminClient } from "./supabase/admin";
import { generateUniqueCode } from "./codes";
import { lisbonToday, addDays, isLeapYear } from "./date";

export async function runBirthdayCheck(): Promise<{ created: number }> {
  const supabase = createAdminClient();
  const today = lisbonToday();
  const [todayY, todayM, todayD] = today.split("-").map(Number);

  const { data: settings } = await supabase
    .from("birthday_settings")
    .select("active, percent, valid_days")
    .eq("id", 1)
    .maybeSingle();

  if (!settings || !settings.active) return { created: 0 };

  const { data: clients } = await supabase
    .from("clients")
    .select("id, birth_date")
    .eq("consent", true)
    .not("birth_date", "is", null);

  let created = 0;

  for (const client of clients ?? []) {
    if (!client.birth_date) continue;
    const [, bm, bd] = client.birth_date.split("-").map(Number);

    const matchDay = bm === 2 && bd === 29 && !isLeapYear(todayY) ? 28 : bd;
    if (bm !== todayM || matchDay !== todayD) continue;

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
    const { error } = await supabase.from("discount_codes").insert({
      code,
      kind: "birthday",
      percent: settings.percent,
      client_id: client.id,
      valid_from: today,
      valid_to: addDays(today, settings.valid_days),
    });

    if (!error) created++;
  }

  return { created };
}
