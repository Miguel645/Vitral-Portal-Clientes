"use server";

import { createClient } from "@/lib/supabase/server";
import { sendSms } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";
import { clientFirstName, composeMessage } from "@/lib/smsText";

export type TestSmsState = { ok?: string; error?: string; field?: "message" | "phone" };

export async function sendTestSms(_prev: TestSmsState, formData: FormData): Promise<TestSmsState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "");
  const appUrl = process.env.APP_URL ?? "";

  if (!message.trim()) return { error: "Escreva a mensagem.", field: "message" };
  if (!phone) return { error: "Escreva o número de telefone para o teste.", field: "phone" };
  if (!normalizePhone(phone).ok) {
    return { error: "O telemóvel tem de ter 9 dígitos e começar por 9 (ou começar por +, se for estrangeiro).", field: "phone" };
  }

  // Not a real client's token: the link in a test SMS opens "Link inválido".
  const testToken = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const finalText = composeMessage(message, "Cliente Teste", appUrl, testToken);

  const result = await sendSms(phone, finalText);
  return result.ok ? { ok: "SMS de teste enviado com sucesso." } : { error: result.error };
}

export type SendAllState = { result?: string; error?: string };

// How many SMS go out at the same time: fast enough for a few hundred clients
// within the page's time limit, gentle enough on Twilio.
const BATCH = 10;

export async function sendCampaign(_prev: SendAllState, formData: FormData): Promise<SendAllState> {
  const message = String(formData.get("message") ?? "");
  const appUrl = process.env.APP_URL ?? "";
  if (!message.trim()) return { error: "Escreva a mensagem." };

  const supabase = await createClient();
  // Only clients who want to receive messages, never anyone else.
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, phone, short_token")
    .eq("consent", true)
    .neq("phone", "");
  if (error) return { error: "Não foi possível ler a lista de clientes. Tente novamente." };

  const recipients = data ?? [];
  if (recipients.length === 0) return { error: "Nenhum cliente quer receber mensagens. Nada foi enviado." };

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const results = await Promise.all(
      recipients.slice(i, i + BATCH).map((c) =>
        sendSms(c.phone, composeMessage(message, clientFirstName(c.name), appUrl, c.short_token), c.id)
      )
    );
    for (const r of results) {
      if (r.ok) sent++;
      else failed++;
    }
  }

  const simulated = process.env.SMS_MODE !== "twilio";
  const parts = [
    simulated
      ? `${sent} SMS simulados (modo de teste, nada foi enviado de verdade).`
      : `${sent} SMS enviados.`,
  ];
  if (failed > 0) parts.push(`${failed} SMS falharam — veja o registo de SMS para saber quais.`);
  return { result: parts.join(" ") };
}
