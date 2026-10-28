import "server-only";
import type { SmsProvider } from "../types";
import { isGsm7 } from "../../smsText";
import { brevoErrorMessage } from "./brevoErrors";

const ENDPOINT = "https://api.brevo.com/v3/transactionalSMS/send";

// BREVO_SMS_SENDER: up to 11 letters/digits ("Vitral"), or a number of up to 15 digits.
function validSender(raw: string): string | null {
  const s = raw.trim();
  if (/^(?=.*[A-Za-z])[A-Za-z0-9]{1,11}$/.test(s) || /^\d{1,15}$/.test(s)) return s;
  return null;
}

export function brevoProvider(): SmsProvider {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = validSender(process.env.BREVO_SMS_SENDER ?? "");

  return {
    okStatus: "sent",
    async send(to, text) {
      if (!apiKey) return { ok: false, error: "Falta o BREVO_API_KEY nas definições do Vercel." };
      if (!sender) {
        return {
          ok: false,
          error: "O BREVO_SMS_SENDER falta ou não é válido: use até 11 letras ou números, sem espaços (Vitral).",
        };
      }
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender,
            recipient: to,
            content: text,
            // Promotions, vales and birthday messages are all marketing messages.
            type: "marketing",
            // Keeps letters like á and ç when the text has them (each SMS then holds 70 characters).
            unicodeEnabled: !isGsm7(text),
            tag: "vitral",
          }),
          signal: AbortSignal.timeout(20_000),
        });
        const body = (await res.json().catch(() => null)) as { messageId?: number; code?: string } | null;
        if (!res.ok) return { ok: false, error: brevoErrorMessage(res.status, body?.code) };
        return { ok: true, providerId: body?.messageId != null ? String(body.messageId) : null };
      } catch {
        return { ok: false, error: "Não foi possível falar com o Brevo. Tente novamente daqui a alguns minutos." };
      }
    },
  };
}
