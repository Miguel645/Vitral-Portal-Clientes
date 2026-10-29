-- SMS history is kept for 12 months (owner decision, 2026-10-29): older messages (phone
-- number and text) are deleted by the daily 10:00 job, but every campaign keeps its
-- totals (enviados / falharam / ignorados / interrompidos) for its summary.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted when you run this: it adds columns and a function. The deleting
-- only happens when the daily job calls the function.

-- 1. Totals of a campaign's messages already deleted from the history.
alter table public.campaigns add column if not exists archived_sent integer not null default 0;
alter table public.campaigns add column if not exists archived_simulated integer not null default 0;
alter table public.campaigns add column if not exists archived_failed integer not null default 0;
alter table public.campaigns add column if not exists archived_skipped integer not null default 0;
alter table public.campaigns add column if not exists archived_interrupted integer not null default 0;
-- When its oldest messages were first deleted (the summary then stops counting who's missing).
alter table public.campaigns add column if not exists log_archived_at timestamptz;

-- 2. Deletes history rows older than 12 months, in one step:
--    - a campaign's rows are first added to its totals above;
--    - rows of a campaign still being sent (sent, not stopped, "Fim" today or later) and
--      of a "Criar vales" run not finished yet are kept: they stop anyone getting the
--      same SMS twice;
--    - test SMS are simply deleted.
--    Returns how many rows were deleted.
create or replace function public.archive_old_sms_log() returns integer
language plpgsql
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - interval '12 months';
  today date := (now() at time zone 'Europe/Lisbon')::date;
  deleted integer;
begin
  update public.campaigns c set
    archived_sent = c.archived_sent + s.sent,
    archived_simulated = c.archived_simulated + s.simulated,
    archived_failed = c.archived_failed + s.failed,
    archived_skipped = c.archived_skipped + s.skipped,
    archived_interrupted = c.archived_interrupted + s.interrupted,
    log_archived_at = coalesce(c.log_archived_at, now())
  from (
    select
      l.campaign_id,
      count(*) filter (where l.status = 'sent') as sent,
      count(*) filter (where l.status = 'simulated') as simulated,
      count(*) filter (where l.status = 'failed') as failed,
      count(*) filter (where l.status = 'skipped') as skipped,
      count(*) filter (where l.status = 'sending') as interrupted
    from public.sms_log l
    where l.created_at < cutoff and l.is_test = false and l.campaign_id is not null
    group by l.campaign_id
  ) s
  where c.id = s.campaign_id
    and not (c.status = 'sent' and c.stopped_at is null and coalesce(c.live_until >= today, false));

  delete from public.sms_log l
  where l.created_at < cutoff
    and (
      l.campaign_id is null
      or l.is_test
      or exists (
        select 1 from public.campaigns c
        where c.id = l.campaign_id
          and not (c.status = 'sent' and c.stopped_at is null and coalesce(c.live_until >= today, false))
      )
    )
    and (
      l.batch_id is null
      or exists (select 1 from public.vale_batches b where b.id = l.batch_id and b.finished_at is not null)
    );
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- Only the server (service role, used by the daily job) may run it: a signed-in session
-- can't call it to empty the history.
revoke execute on function public.archive_old_sms_log() from public, anon, authenticated;
grant execute on function public.archive_old_sms_log() to service_role;
