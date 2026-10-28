-- Campaign start and end dates (2026-10-28): every campaign has "Início" (starts_on)
-- and "Fim" (live_until). A campaign starting later is 'scheduled' and the daily job
-- sends it at 10:00 Lisbon on its start date.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted: this adds one column and allows the new status 'scheduled'.

alter table public.campaigns add column if not exists starts_on date;

alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check check (status in ('draft', 'scheduled', 'sent'));
