import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrlError } from "@/lib/optOut";
import { lisbonToday } from "@/lib/date";
import { deliver, TIME_BUDGET_MS, type CampaignRow } from "./deliver";
import { pendingRecipients, RESUME_AFTER_MS } from "./recipients";

export type LiveResult = { error?: string; campaigns: number; clients: number; messages: string[] };

// The daily job (10:00 Lisbon, /api/cron/campaigns). Runs without a session, so it
// uses the admin client.
// 1. Scheduled campaigns whose "Início" has come are sent to every client who receives
//    messages, like "Enviar campanha". If nothing could be sent, it goes back to
//    scheduled and is tried again the next day.
// 2. Every live campaign (sent, not stopped, "Fim" today or later) whose send stopped
//    half-way (time limit) is finished: clients who existed when it was created and
//    received messages when it was first sent, and haven't got it yet. Clients added
//    after a campaign was created never get it (see pendingRecipients). Anyone not
//    reached in time gets it the next day.
// A campaign that fails is reported and the others still go out.
export async function runLiveCampaigns(): Promise<LiveResult> {
  const result: LiveResult = { campaigns: 0, clients: 0, messages: [] };
  const urlError = appUrlError();
  if (urlError) return { ...result, error: urlError };

  const startedAt = Date.now();
  const supabase = createAdminClient();
  const today = lisbonToday();

  const { data: scheduled, error: scheduledError } = await supabase
    .from("campaigns")
    .select("id, name, sms_text, vale_percent, vale_amount_eur, vale_valid_from, vale_valid_to")
    .eq("status", "scheduled")
    .lte("starts_on", today)
    .gte("live_until", today)
    .order("starts_on");
  if (scheduledError) return { ...result, error: "Não foi possível ler as campanhas." };

  for (const campaign of scheduled ?? []) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    // Mark it as sent first (only if still scheduled), so it can never go out twice.
    const now = new Date().toISOString();
    const { data: claimed } = await supabase
      .from("campaigns")
      .update({ status: "sent", sent_at: now, first_sent_at: now })
      .eq("id", campaign.id)
      .eq("status", "scheduled")
      .select("id");
    if (!claimed?.length) continue;

    let sent: Awaited<ReturnType<typeof deliver>>;
    try {
      const recipients = await pendingRecipients(supabase, campaign.id);
      if (recipients.length === 0) continue;
      sent = await deliver(supabase, campaign.id, campaign as CampaignRow, recipients, startedAt);
      result.campaigns++;
      result.clients += recipients.length;
    } catch {
      sent = { error: "Não foi possível ler a lista de clientes.", nothingSent: true };
    }
    if ("error" in sent && sent.nothingSent) {
      // Nothing was created or sent: back to scheduled, so tomorrow's run tries again.
      await supabase
        .from("campaigns")
        .update({ status: "scheduled", sent_at: null, first_sent_at: null })
        .eq("id", campaign.id)
        .eq("status", "sent");
    }
    result.messages.push(`${campaign.name}: ${"error" in sent ? sent.error : sent.message}`);
  }

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id, name, sms_text, sent_at, first_sent_at, vale_percent, vale_amount_eur, vale_valid_from, vale_valid_to")
    .eq("status", "sent")
    .is("stopped_at", null)
    .not("first_sent_at", "is", null)
    .gte("live_until", today)
    .order("first_sent_at");
  if (error) return { ...result, error: "Não foi possível ler as campanhas." };

  for (const campaign of campaigns ?? []) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    let recipients;
    try {
      recipients = await pendingRecipients(supabase, campaign.id, campaign.first_sent_at);
    } catch {
      result.messages.push(`${campaign.name}: Não foi possível ler a lista de clientes.`);
      continue;
    }
    if (recipients.length === 0) continue;

    // Same claim as "Continuar envio": skip a campaign someone is sending right now,
    // and move sent_at forward only if nobody else did, so nothing goes out twice.
    if (campaign.sent_at && Date.now() - new Date(campaign.sent_at).getTime() < RESUME_AFTER_MS) continue;
    let claim = supabase.from("campaigns").update({ sent_at: new Date().toISOString() }).eq("id", campaign.id);
    claim = campaign.sent_at ? claim.eq("sent_at", campaign.sent_at) : claim.is("sent_at", null);
    const { data: claimed } = await claim.select("id");
    if (!claimed?.length) continue;

    try {
      const sent = await deliver(supabase, campaign.id, campaign as CampaignRow, recipients, startedAt);
      result.campaigns++;
      result.clients += recipients.length;
      result.messages.push(`${campaign.name}: ${"error" in sent ? sent.error : sent.message}`);
    } catch {
      result.messages.push(`${campaign.name}: o envio parou com um erro; continua amanhã.`);
    }
  }
  return result;
}
