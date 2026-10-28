import "server-only";
import twilio from "twilio";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { normalizePhone } from "./phone";

export type SendSmsResult = { ok: true } | { ok: false; error: string };

// `db` is only needed where there's no signed-in session (the birthday cron job),
// which passes the admin client so the message can still be logged.
export async function sendSms(to: string, text: string, clientId?: string, db?: SupabaseClient): Promise<SendSmsResult> {
  const normalized = normalizePhone(to);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  const mode = process.env.SMS_MODE === "twilio" ? "twilio" : "simulate";
  const supabase = db ?? (await createClient());

  if (mode === "simulate") {
    await supabase.from("sms_log").insert({
      to_phone: normalized.value,
      body: text,
      status: "simulated",
      client_id: clientId ?? null,
    });
    return { ok: true };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "A configuração do Twilio está incompleta." };
  }

  try {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      to: normalized.value,
      from,
      body: text,
      smartEncoded: true,
    });
    await supabase.from("sms_log").insert({
      to_phone: normalized.value,
      body: text,
      status: "sent",
      client_id: clientId ?? null,
    });
    return { ok: true };
  } catch {
    await supabase.from("sms_log").insert({
      to_phone: normalized.value,
      body: text,
      status: "failed",
      client_id: clientId ?? null,
    });
    return { ok: false, error: "Não foi possível enviar o SMS. Tente novamente." };
  }
}
