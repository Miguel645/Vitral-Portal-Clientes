import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrlError } from "@/lib/optOut";
import { lisbonToday } from "@/lib/date";
import { startJob } from "@/lib/jobs";

export type LiveResult = { error?: string; started: number; messages: string[] };

// The daily job (10:00 Lisbon, /api/cron/campaigns). Runs without a session, so it
// uses the admin client.
// 1. Scheduled campaigns whose "Início" has come are marked as sent (only if still
//    scheduled, so never twice) and start sending in the background.
// 2. Safety net: every campaign still being sent (sent, not stopped, "Fim" today or
//    later) and every "Criar vales" run not finished yet gets a background step. Normally
//    they finished long ago (each step starts the next one by itself) and the step
//    finds nobody left; this only matters if a hand-off was ever lost.
export async function runLiveCampaigns(): Promise<LiveResult> {
  const result: LiveResult = { started: 0, messages: [] };
  const urlError = appUrlError();
  if (urlError) return { ...result, error: urlError };

  const supabase = createAdminClient();
  const today = lisbonToday();

  const { data: scheduled, error: scheduledError } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("status", "scheduled")
    .lte("starts_on", today)
    .gte("live_until", today)
    .order("starts_on");
  if (scheduledError) return { ...result, error: "Não foi possível ler as campanhas." };

  for (const campaign of scheduled ?? []) {
    // Clients added, or who switch messages on, after this never get it (see pendingRecipients).
    const now = new Date().toISOString();
    const { data: claimed } = await supabase
      .from("campaigns")
      .update({ status: "sent", sent_at: now, first_sent_at: now })
      .eq("id", campaign.id)
      .eq("status", "scheduled")
      .select("id");
    if (!claimed?.length) continue;
    result.messages.push(`${campaign.name}: enviada hoje.`);
  }

  const [{ data: campaigns, error }, { data: batches, error: batchError }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name")
      .eq("status", "sent")
      .is("stopped_at", null)
      .not("first_sent_at", "is", null)
      .gte("live_until", today),
    supabase.from("vale_batches").select("id").is("finished_at", null),
  ]);
  if (error || batchError) return { ...result, error: "Não foi possível ler os envios por terminar." };

  // Every step starts in its own function; a campaign that fails never stops the others.
  const jobs = [
    ...(campaigns ?? []).map((c) => ({ kind: "campaign" as const, id: c.id })),
    ...(batches ?? []).map((b) => ({ kind: "vales" as const, id: b.id })),
  ];
  const started = await Promise.all(jobs.map((job) => startJob(job)));
  result.started = started.filter(Boolean).length;
  if (result.started < jobs.length) {
    return { ...result, error: `Não foi possível começar ${jobs.length - result.started} de ${jobs.length} envios (veja o CRON_SECRET).` };
  }
  return result;
}
