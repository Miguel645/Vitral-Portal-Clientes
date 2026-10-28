"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type WelcomeField = "sms_text" | "value" | "valid_days";

// The form keeps what was typed itself (it's controlled), so only the error comes back.
export type WelcomeState = { error?: string; field?: WelcomeField };

export async function saveWelcomeSettings(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const active = formData.get("active") === "on";
  const smsText = String(formData.get("sms_text") ?? "").trim();
  const withVale = formData.get("with_vale") === "on";

  if (!smsText) return { error: "Escreva a mensagem.", field: "sms_text" };

  let vale = { vale_percent: null as number | null, vale_amount_eur: null as number | null, vale_valid_days: null as number | null };
  if (!withVale) {
    if (smsText.includes("{vale}")) {
      return { error: "Tire {vale} da mensagem, ou marque “Incluir um vale”.", field: "sms_text" };
    }
  } else {
    const discountType = String(formData.get("discount_type") ?? "");
    const valueRaw = String(formData.get("value") ?? "").trim();
    const value = Number(valueRaw.replace(",", "."));
    const daysRaw = String(formData.get("valid_days") ?? "").trim();
    const days = Number(daysRaw);

    if (!smsText.includes("{vale}")) {
      return { error: "A mensagem tem de incluir {vale}, para o cliente receber o código do vale.", field: "sms_text" };
    }
    if (discountType !== "percent" && discountType !== "amount") {
      return { error: "Escolha se o vale é uma percentagem ou um valor em euros." };
    }
    if (discountType === "percent" && (!valueRaw || !Number.isFinite(value) || value < 1 || value > 100)) {
      return {
        error: valueRaw ? "A percentagem tem de ser um número de 1 a 100." : "Escreva a percentagem de desconto.",
        field: "value",
      };
    }
    if (discountType === "amount" && (!valueRaw || !Number.isFinite(value) || value <= 0 || value > 10000)) {
      return {
        error: valueRaw ? "O valor tem de ser um número maior que zero." : "Escreva o valor do desconto em euros.",
        field: "value",
      };
    }
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return {
        error: daysRaw ? "Os dias têm de ser um número inteiro, 1 ou mais." : "Escreva quantos dias dura o vale.",
        field: "valid_days",
      };
    }
    vale = {
      vale_percent: discountType === "percent" ? value : null,
      vale_amount_eur: discountType === "amount" ? Math.round(value * 100) / 100 : null,
      vale_valid_days: days,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("welcome_settings").upsert({ id: 1, active, sms_text: smsText, ...vale });
  if (error) return { error: "Não foi possível guardar. Verifique os dados e tente novamente." };
  redirect(`/settings?message=${encodeURIComponent("Mensagem de boas-vindas guardada.")}`);
}
