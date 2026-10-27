"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runBirthdayCheck } from "@/lib/birthdayCodes";

function parse(formData: FormData) {
  const active = formData.get("active") === "on";
  const percentRaw = String(formData.get("percent") ?? "").trim().replace(",", ".");
  const validDaysRaw = String(formData.get("valid_days") ?? "").trim();
  const percent = Number(percentRaw);
  const validDays = Number(validDaysRaw);

  let error = "";
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    error = "Indique uma percentagem entre 1 e 100.";
  } else if (!Number.isInteger(validDays) || validDays < 1) {
    error = "Indique um número de dias válido (1 ou mais).";
  }

  return { error, row: { id: 1, active, percent, valid_days: validDays } };
}

export async function saveBirthdaySettings(formData: FormData) {
  const { error, row } = parse(formData);
  if (error) redirect(`/settings/birthday?error=${encodeURIComponent(error)}`);

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("birthday_settings").upsert(row);

  if (dbError) redirect(`/settings/birthday?error=${encodeURIComponent("Não foi possível guardar. Tente novamente.")}`);
  redirect(`/settings/birthday?message=${encodeURIComponent("Definições guardadas.")}`);
}

export async function runBirthdayCheckNow() {
  const result = await runBirthdayCheck();
  const message = `Verificação concluída: ${result.created} código(s) de aniversário criado(s).`;
  redirect(`/settings/birthday?message=${encodeURIComponent(message)}`);
}
