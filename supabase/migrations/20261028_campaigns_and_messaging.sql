-- Saved campaigns, a fuller SMS log, and consent dates.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted: this only ADDS tables, columns and a trigger.

-- 1. Consent (GDPR). `consent` stays the "Recebe mensagens" tick box (SMS).
--    email_consent is ready for when email sending is added.
--    consent_at / email_consent_at: when the current consent was given. Filled in
--    automatically by the trigger below; cleared when the client stops receiving.
--    Clients who already had consent before today keep an empty date (unknown).
alter table public.clients add column if not exists email_consent boolean not null default false;
alter table public.clients add column if not exists consent_at timestamptz;
alter table public.clients add column if not exists email_consent_at timestamptz;

create or replace function public.set_consent_dates() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.consent and (tg_op = 'INSERT' or not old.consent) then
    new.consent_at := now();
  elsif not new.consent then
    new.consent_at := null;
  end if;
  if new.email_consent and (tg_op = 'INSERT' or not old.email_consent) then
    new.email_consent_at := now();
  elsif not new.email_consent then
    new.email_consent_at := null;
  end if;
  return new;
end $$;

drop trigger if exists clients_set_consent_dates on public.clients;
create trigger clients_set_consent_dates
  before insert or update of consent, email_consent on public.clients
  for each row execute function public.set_consent_dates();

-- 2. Campaigns. A campaign can include a vale: then every client it's sent to gets
--    their own new vale (percentage or euro amount, valid between the two dates).
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'sms' check (channel in ('sms', 'email')),
  sms_text text not null default '',
  vale_percent numeric,
  vale_amount_eur numeric,
  vale_valid_from date,
  vale_valid_to date,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint campaigns_vale_check check (
    (vale_percent is null and vale_amount_eur is null and vale_valid_from is null and vale_valid_to is null)
    or (
      vale_valid_from is not null and vale_valid_to is not null and vale_valid_from <= vale_valid_to
      and (
        (vale_percent is not null and vale_amount_eur is null and vale_percent >= 1 and vale_percent <= 100)
        or (vale_percent is null and vale_amount_eur is not null and vale_amount_eur > 0)
      )
    )
  )
);

alter table public.campaigns enable row level security;

drop policy if exists "Signed-in users manage campaigns" on public.campaigns;
create policy "Signed-in users manage campaigns"
  on public.campaigns
  for all
  to authenticated
  using (true)
  with check (true);

-- Vales created by a campaign point back to it.
alter table public.discount_codes add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

-- 3. SMS log ("Histórico de envios"). status: simulated / sent / failed / skipped.
alter table public.sms_log add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.sms_log add column if not exists channel text not null default 'sms';
alter table public.sms_log add column if not exists error text;
alter table public.sms_log add column if not exists provider_id text;
alter table public.sms_log add column if not exists is_test boolean not null default false;

create index if not exists sms_log_created_at_idx on public.sms_log (created_at desc);
create index if not exists sms_log_campaign_id_idx on public.sms_log (campaign_id);
