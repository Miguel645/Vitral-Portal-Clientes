import "server-only";
import type { SmsProvider } from "../types";
import { twilioErrorMessage } from "./twilioErrors";

// TWILIO_SMS_SENDER can be:
// - a Twilio phone number in international format ("+1…"), needed on trial accounts;
// - a sender name of up to 11 letters/digits ("Vitral"), once the account is upgraded;
// - a Messaging Service id ("MG…").
function senderParams(raw: string): { From: string } | { MessagingServiceSid: string } | null {
  const s = raw.trim();
  if (/^\+\d{8,15}$/.test(s)) return { From: s };
  if (/^MG[0-9a-f]{32}$/i.test(s)) return { MessagingServiceSid: s };
  if (/^(?=.*[A-Za-z])[A-Za-z0-9 ]{1,11}$/.test(s)) return { From: s };
  return null;
}

export function twilioProvider(): SmsProvider {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const sender = senderParams(process.env.TWILIO_SMS_SENDER ?? "");

  return {
    okStatus: "sent",
    async send(to, text) {
      if (!accountSid || !authToken) {
        return { ok: false, error: "Faltam o TWILIO_ACCOUNT_SID ou o TWILIO_AUTH_TOKEN nas definições do Vercel." };
      }
      if (!sender) {
        return {
          ok: false,
          error: "O TWILIO_SMS_SENDER falta ou não é válido: use um número (+1…) ou um nome até 11 letras (Vitral).",
        };
      }
      // Plain fetch to Twilio's REST API, like the Brevo provider (no twilio package).
      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
          method: "POST",
          headers: {
            authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded",
            accept: "application/json",
          },
          body: new URLSearchParams({ To: to, Body: text, ...sender }),
          signal: AbortSignal.timeout(20_000),
        });
        // On error Twilio answers with { code, message }; twilioErrorMessage reads the code.
        const body = (await res.json().catch(() => null)) as { sid?: string; code?: number } | null;
        if (!res.ok) return { ok: false, error: twilioErrorMessage(body ?? { code: res.status === 401 ? 20003 : undefined }) };
        return { ok: true, providerId: body?.sid ?? null };
      } catch {
        return { ok: false, error: twilioErrorMessage(null) };
      }
    },
  };
}
