-- Deleting a client also deletes their SMS history (owner decision, 2026-10-31), so a
-- client who asks for all their data to be erased leaves no phone number or message text
-- behind. Each campaign keeps its totals (enviados / falharam / ...), like the 12-month
-- clean-up does.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted when you run this: it adds a rule that runs when a client is deleted
-- (from the app or from the Supabase dashboard).

create or replace function public.forget_client_sms() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 1. The client's campaign messages go into each campaign's totals.
  update public.campaigns c set
    archived_sent = c.archived_sent + s.sent,
    archived_simulated = c.archived_simulated + s.simulated,
    archived_failed = c.archived_failed + s.failed,
    archived_skipped = c.archived_skipped + s.skipped,
    archived_interrupted = c.archived_interrupted + s.interrupted
  from (
    select
      l.campaign_id,
      count(*) filter (where l.status = 'sent') as sent,
      count(*) filter (where l.status = 'simulated') as simulated,
      count(*) filter (where l.status = 'failed') as failed,
      count(*) filter (where l.status = 'skipped') as skipped,
      count(*) filter (where l.status = 'sending') as interrupted
    from public.sms_log l
    where l.client_id = old.id and l.is_test = false and l.campaign_id is not null
    group by l.campaign_id
  ) s
  where c.id = s.campaign_id;

  -- 2. Then every message to this client is deleted.
  delete from public.sms_log where client_id = old.id;
  return old;
end;
$$;

drop trigger if exists clients_forget_sms on public.clients;
create trigger clients_forget_sms
  before delete on public.clients
  for each row execute function public.forget_client_sms();
