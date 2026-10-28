-- Live campaigns (2026-10-28): after a campaign is sent, a daily job (10:00 Lisbon)
-- sends it to clients added since, until "Ativa até" or until it's stopped.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted: this only ADDS three columns to campaigns.

-- When the campaign was first sent: clients created after this are "new clients".
-- (sent_at moves forward with every "Continuar envio" and daily run, so it can't be used.)
alter table public.campaigns add column if not exists first_sent_at timestamptz;
-- Last day new clients still get it; empty = not sent to new clients.
alter table public.campaigns add column if not exists live_until date;
-- Set by "Parar envio a clientes novos".
alter table public.campaigns add column if not exists stopped_at timestamptz;

-- Campaigns sent before this: their first SMS says when they were first sent.
-- They have no live_until, so they don't become live.
update public.campaigns c
set first_sent_at = coalesce(
  (select min(l.created_at) from public.sms_log l where l.campaign_id = c.id and l.is_test = false),
  c.sent_at
)
where c.status = 'sent' and c.first_sent_at is null;
