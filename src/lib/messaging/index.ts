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

// Logged before the provider is asked, and replaced by the real result once it answers.
// If the page stops in between (e.g. the 60-second limit), the row stays like this:
// the SMS may or may not have gone out, and it is never sent again.
export const INTERRUPTED_STATUS = "sending";
const INTERRUPTED_ERROR = "O envio parou antes de haver resposta. Veja nos registos do fornecedor de SMS se chegou.";

// The one way to send an SMS. Server-only: credentials never reach the browser.
// Every attempt is written to sms_log, including numbers that were skipped and why.
export async function sendSms(to: string, text: string, opts: SendOptions = {}): Promise<SendResult> {
  const supabase = opts.db ?? (await createClient());
  const log = (row: { to_phone: string; status: string; error: string | null; provider_id: string | null }) =>
    supabase
      .from("sms_log")
      .insert({
        ...row,
        channel: "sms",
        body: text,
        client_id: opts.clientId ?? null,
        campaign_id: opts.campaignId ?? null,
        is_test: opts.isTest ?? false,
      })
      .select("id")
      .single();

  const phone = normalizePhone(to);
  if (!phone.ok) {
    const error = "Número de telemóvel inválido, por isso o SMS não foi enviado.";
    await log({ to_phone: to.trim() || "—", status: "skipped", error, provider_id: null });
    return { ok: false, status: "skipped", providerId: null, error };
  }

  // No log row, no SMS: a campaign that continues later relies on the log to never send twice.
  const { data: logged } = await log({
    to_phone: phone.value,
    status: INTERRUPTED_STATUS,
    error: INTERRUPTED_ERROR,
    provider_id: null,
  });
  if (!logged) {
    return {
      ok: false,
      status: "failed",
      providerId: null,
      error: "Não foi possível registar o envio, por isso o SMS não foi enviado. Tente novamente.",
    };
  }

  const provider = smsProvider();
  const result = await provider.send(phone.value, text);
  const sent: SendResult = result.ok
    ? { ok: true, status: provider.okStatus, providerId: result.providerId, error: null }
    : { ok: false, status: "failed", providerId: null, error: result.error };

  await supabase
    .from("sms_log")
    .update({ status: sent.status, error: sent.error, provider_id: sent.providerId })
    .eq("id", logged.id);
  return sent;
}

// Email comes later (planned provider: Resend). Same shape as sendSms, so pages
// won't need to change when it's added.
// The parameters aren't used until then.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendEmail(_to: string, _subject: string, _text: string, _opts: SendOptions = {}): Promise<SendResult> {
  return { ok: false, status: "failed", providerId: null, error: "O envio de email ainda não está disponível." };
}
