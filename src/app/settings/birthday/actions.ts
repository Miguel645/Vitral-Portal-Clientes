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
  let field: SettingsState["field"];
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    error = percentRaw ? "A percentagem tem de ser um número de 1 a 100." : "Escreva a percentagem de desconto.";
    field = "percent";
  } else if (!Number.isInteger(validDays) || validDays < 1) {
    error = validDaysRaw ? "Os dias têm de ser um número inteiro, 1 ou mais." : "Escreva quantos dias dura o vale.";
    field = "valid_days";
  }

  return {
    error,
    field,
    values: { active, percent: percentRaw, valid_days: validDaysRaw },
    row: { id: 1, active, percent, valid_days: validDays },
  };
}

export type SettingsState = {
  error?: string;
  field?: "percent" | "valid_days";
  // What was typed, so an error doesn't empty the form.
  values?: { active: boolean; percent: string; valid_days: string };
};

export async function saveBirthdaySettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { error, field, values, row } = parse(formData);
  if (error) return { error, field, values };

  const supabase = await createClient();
  const { error: dbError } = await supabase.from("birthday_settings").upsert(row);

  if (dbError) {
    return { error: "Não foi possível guardar. Verifique os dados e tente novamente.", values };
  }
  redirect(`/settings/birthday?message=${encodeURIComponent("Definições guardadas.")}`);
}

export async function runBirthdayCheckNow() {
  const result = await runBirthdayCheck();
  const parts: string[] = [];
  if (result.created === 0) {
    parts.push("Não há vales novos para criar hoje.");
  } else {
    parts.push(`Foram criados ${result.created} ${result.created === 1 ? "vale" : "vales"} de aniversário.`);
    const simulated = process.env.SMS_MODE !== "twilio";
    parts.push(`${result.smsSent} SMS ${simulated ? "simulados (modo de teste, nada foi enviado de verdade)" : "enviados"}.`);
    if (result.smsFailed > 0) parts.push(`${result.smsFailed} SMS falharam — veja o registo de SMS em Definições.`);
  }
  const message = parts.join(" ");
  redirect(`/settings/birthday?message=${encodeURIComponent(message)}`);
}
