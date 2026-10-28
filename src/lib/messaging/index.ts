import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { normalizePhone } from "../phone";
import { messagingMode } from "./mode";
import { simulationProvider } from "./providers/simulation";
import { brevoProvider } from "./providers/brevo";
import { twilioProvider } from "./providers/twilio";
import type { SendResult, SmsProvider } from "./types";

export type { SendResult, SendStatus } from "./types";
export { isSimulation, messagingMode } from "./mode";

export type SendOptions = {
  clientId?: string;
  campaignId?: string;
  // A test SMS from the campaign page (shown as "Teste" in the history).
  isTest?: boolean;
  // Only needed where there's no signed-in session (the birthday cron job),
  // which passes the admin client so the message can still be logged.
  db?: SupabaseClient;
};

function smsProvider(): SmsProvider {
  const mode = messagingMode();
  if (mode === "brevo") return brevoProvider();
  if (mode === "twilio") return twilioProvider();
  return simulationProvider;
}

// The one way to send an SMS. Server-only: credentials never reach the browser.
// Every attempt is written to sms_log, including numbers that were skipped and why.
export async function sendSms(to: string, text: string, opts: SendOptions = {}): Promise<SendResult> {
  const supabase = opts.db ?? (await createClient());
  const log = (row: { to_phone: string; status: string; error: string | null; provider_id: string | null }) =>
    supabase.from("sms_log").insert({
      ...row,
      channel: "sms",
      body: text,
      client_id: opts.clientId ?? null,
      campaign_id: opts.campaignId ?? null,
      is_test: opts.isTest ?? false,
    });

  const phone = normalizePhone(to);
  if (!phone.ok) {
    const error = "Número de telemóvel inválido, por isso o SMS não foi enviado.";
    await log({ to_phone: to.trim() || "—", status: "skipped", error, provider_id: null });
    return { ok: false, status: "skipped", providerId: null, error };
  }

  const provider = smsProvider();
  const result = await provider.send(phone.value, text);
  const sent: SendResult = result.ok
    ? { ok: true, status: provider.okStatus, providerId: result.providerId, error: null }
    : { ok: false, status: "failed", providerId: null, error: result.error };

  await log({ to_phone: phone.value, status: sent.status, error: sent.error, provider_id: sent.providerId });
  return sent;
}

// Email comes later (planned provider: Resend). Same shape as sendSms, so pages
// won't need to change when it's added.
export async function sendEmail(_to: string, _subject: string, _text: string, _opts: SendOptions = {}): Promise<SendResult> {
  return { ok: false, status: "failed", providerId: null, error: "O envio de email ainda não está disponível." };
}
