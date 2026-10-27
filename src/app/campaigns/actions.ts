"use server";

import { redirect } from "next/navigation";
import { sendSms } from "@/lib/sms";
import { composeMessage } from "@/lib/smsText";

export async function sendTestSms(formData: FormData) {
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "");
  const appUrl = process.env.APP_URL ?? "";

  const back = `/campaigns/new?message=${encodeURIComponent(message)}`;

  if (!phone) {
    redirect(`${back}&testError=${encodeURIComponent("Indique um número de telefone para o teste.")}`);
  }

  const testToken = crypto.randomUUID();
  const finalText = composeMessage(message, "Cliente Teste", appUrl, testToken);

  const result = await sendSms(phone, finalText);

  if (result.ok) {
    redirect(`${back}&testOk=${encodeURIComponent("SMS de teste enviado com sucesso.")}`);
  }
  redirect(`${back}&testError=${encodeURIComponent(result.error)}`);
}
