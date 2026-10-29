import "server-only";
import { createAdminClient } from "../supabase/admin";

// How long the send history keeps each message (owner decision, 2026-10-29).
export const SMS_LOG_KEEP_MONTHS = 12;

// Deletes history rows older than 12 months (the database function archive_old_sms_log,
// see supabase/migrations/20261029_sms_log_retention.sql). Each campaign keeps its
// totals; rows of a campaign or "Criar vales" run still being sent are kept. Run by the
// daily 10:00 job. Returns how many rows were deleted, or an error.
export async function archiveOldSmsLog(): Promise<{ deleted: number } | { error: string }> {
  const { data, error } = await createAdminClient().rpc("archive_old_sms_log");
  if (error) return { error: `Não foi possível apagar as mensagens com mais de ${SMS_LOG_KEEP_MONTHS} meses.` };
  return { deleted: Number(data ?? 0) };
}
