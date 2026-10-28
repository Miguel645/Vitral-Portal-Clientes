import "server-only";
import twilio from "twilio";
import type { SmsProvider } from "../types";
import { twilioErrorMessage } from "./twilioErrors";

// TWILIO_SMS_SENDER can be:
// - a Twilio phone number in international format ("+1…"), needed on trial accounts;
// - a sender name of up to 11 letters/digits ("Vitral"), once the account is upgraded;
// - a Messaging Service id ("MG…").
function senderParams(raw: string): { from: string } | { messagingServiceSid: string } | null {
  const s = raw.trim();
  if (/^\+\d{8,15}$/.test(s)) return { from: s };
  if (/^MG[0-9a-f]{32}$/i.test(s)) return { messagingServiceSid: s };
  if (/^(?=.*[A-Za-z])[A-Za-z0-9 ]{1,11}$/.test(s)) return { from: s };
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
      try {
        const message = await twilio(accountSid, authToken).messages.create({ to, body: text, ...sender });
        return { ok: true, providerId: message.sid };
      } catch (err) {
        return { ok: false, error: twilioErrorMessage(err) };
      }
    },
  };
}
