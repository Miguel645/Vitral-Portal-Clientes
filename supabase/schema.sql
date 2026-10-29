-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  birth_date date,
  consent boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only signed-in users can see or change clients.
alter table public.clients enable row level security;

drop policy if exists "Anyone can manage clients" on public.clients;
drop policy if exists "Signed-in users manage clients" on public.clients;
create policy "Signed-in users manage clients"
  on public.clients
  for all
  to authenticated
  using (true)
  with check (true);

-- Opt-out link: every client gets a unique token used by the public /u/[token]
-- unsubscribe page. Backfills any existing rows that don't have one yet.
alter table public.clients add column if not exists unsubscribe_token uuid unique default gen_random_uuid();

update public.clients set unsubscribe_token = gen_random_uuid() where unsubscribe_token is null;

-- Discount codes v2: replaces the earlier generic percentage/fixed code idea
-- with birthday codes and spend-promotion reward codes.

create table if not exists public.birthday_settings (
  id smallint primary key default 1,
  active boolean not null default true,
  percent numeric not null default 10 check (percent >= 1 and percent <= 100),
  valid_days integer not null default 14 check (valid_days >= 1),
  constraint birthday_settings_single_row check (id = 1)
);

insert into public.birthday_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.birthday_settings enable row level security;

drop policy if exists "Anyone can manage birthday settings" on public.birthday_settings;
drop policy if exists "Signed-in users manage birthday settings" on public.birthday_settings;
create policy "Signed-in users manage birthday settings"
  on public.birthday_settings
  for all
  to authenticated
  using (true)
  with check (true);

-- Kind and discount checks are added further down (see "Promotions removed").
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null,
  percent numeric,
  amount_eur numeric,
  note text,
  client_id uuid references public.clients(id) on delete set null,
  valid_from date not null,
  valid_to date not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint discount_codes_valid_window check (valid_from <= valid_to)
);

-- At most one birthday code per client per year.
create unique index if not exists discount_codes_one_birthday_per_year
  on public.discount_codes (client_id, extract(year from valid_from))
  where kind = 'birthday';

alter table public.discount_codes enable row level security;

drop policy if exists "Anyone can manage discount codes" on public.discount_codes;
drop policy if exists "Signed-in users manage discount codes" on public.discount_codes;
create policy "Signed-in users manage discount codes"
  on public.discount_codes
  for all
  to authenticated
  using (true)
  with check (true);

-- Campaigns step 1: SMS sending (simulated or real via Twilio), always logged.
create table if not exists public.sms_log (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  status text not null,
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.sms_log enable row level security;

drop policy if exists "Signed-in users manage sms log" on public.sms_log;
create policy "Signed-in users manage sms log"
  on public.sms_log
  for all
  to authenticated
  using (true)
  with check (true);

-- Vales (vouchers) only, no purchase tracking: staff decide at the till when a
-- client qualifies. Safe to run again on a database that already has the
-- older purchases/spend-promotion shape above.

-- Remove the purchase-tied unique index and column before dropping the table.
drop index if exists public.discount_codes_one_per_purchase_promotion;
alter table public.discount_codes drop column if exists purchase_id;

drop table if exists public.purchases;

-- Promotions removed: vales are created directly, with either a percentage
-- or a fixed euro amount, for one, several or all clients. Vales already
-- created from a promotion are kept and stay valid.
alter table public.discount_codes drop column if exists promotion_id;
drop table if exists public.promotions;

alter table public.discount_codes add column if not exists amount_eur numeric;
alter table public.discount_codes add column if not exists note text;
alter table public.discount_codes alter column percent drop not null;

-- Each vale is either a percentage (1-100) or a euro amount (> 0), never both.
alter table public.discount_codes drop constraint if exists discount_codes_percent_check;
alter table public.discount_codes drop constraint if exists discount_codes_discount_check;
alter table public.discount_codes add constraint discount_codes_discount_check check (
  (percent is not null and amount_eur is null and percent >= 1 and percent <= 100)
  or (percent is null and amount_eur is not null and amount_eur > 0)
);

-- Vale kinds: 'birthday' (automatic) and 'manual' (created by hand).
alter table public.discount_codes drop constraint if exists discount_codes_kind_check;
update public.discount_codes set kind = 'manual' where kind in ('spend', 'promotion');
alter table public.discount_codes add constraint discount_codes_kind_check
  check (kind in ('birthday', 'manual'));

-- Short unsubscribe links (/u/<8 characters>). Same SQL as
-- supabase/migrations/20261028_short_unsubscribe_token.sql; the old
-- unsubscribe_token column stays so links already sent keep working.
create or replace function public.random_short_token() returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  chars constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  bytes bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  result text := '';
  i int;
begin
  foreach i in array array[0, 1, 2, 3, 4, 5, 16, 17] loop
    result := result || substr(chars, 1 + (get_byte(bytes, i) % 36), 1);
  end loop;
  return result;
end $$;

alter table public.clients add column if not exists short_token text;

-- Give every existing client a token, one at a time, retrying on the (very unlikely) clash.
do $$
declare
  r record;
  t text;
begin
  for r in select id from public.clients where short_token is null loop
    loop
      t := public.random_short_token();
      exit when not exists (select 1 from public.clients where short_token = t);
    end loop;
    update public.clients set short_token = t where id = r.id;
  end loop;
end $$;

-- New clients get one automatically when they're saved.
create or replace function public.set_short_token() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t text;
begin
  if new.short_token is null then
    loop
      t := public.random_short_token();
      exit when not exists (select 1 from public.clients where short_token = t);
    end loop;
    new.short_token := t;
  end if;
  return new;
end $$;

drop trigger if exists clients_set_short_token on public.clients;
create trigger clients_set_short_token
  before insert on public.clients
  for each row execute function public.set_short_token();

alter table public.clients alter column short_token set not null;
create unique index if not exists clients_short_token_key on public.clients (short_token);

-- Campaigns, fuller SMS log and consent dates. Same SQL as
-- supabase/migrations/20261028_campaigns_and_messaging.sql.
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

-- Faster vale lists: a client's vales and the newest vales first (migration 20261028_discount_codes_indexes.sql).
create index if not exists discount_codes_client_id_idx on public.discount_codes (client_id);
create index if not exists discount_codes_created_at_idx on public.discount_codes (created_at desc);

-- Welcome SMS for new clients. Same SQL as supabase/migrations/20261028_welcome_sms.sql.
-- 1. The settings: one row, like birthday_settings. Off until switched on.
--    The SMS text uses {nome} and {vale}, like campaigns. The vale is optional:
--    a percentage or a euro amount, valid from the day the client is saved
--    for vale_valid_days more days.
create table if not exists public.welcome_settings (
  id smallint primary key default 1,
  active boolean not null default false,
  sms_text text not null default 'Boas-vindas à Vitral, {nome}! Vai passar a receber as nossas novidades por SMS.',
  vale_percent numeric,
  vale_amount_eur numeric,
  vale_valid_days integer,
  constraint welcome_settings_single_row check (id = 1),
  constraint welcome_settings_vale_check check (
    (vale_percent is null and vale_amount_eur is null and vale_valid_days is null)
    or (
      vale_valid_days is not null and vale_valid_days >= 1
      and (
        (vale_percent is not null and vale_amount_eur is null and vale_percent >= 1 and vale_percent <= 100)
        or (vale_percent is null and vale_amount_eur is not null and vale_amount_eur > 0)
      )
    )
  )
);

insert into public.welcome_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.welcome_settings enable row level security;

drop policy if exists "Signed-in users manage welcome settings" on public.welcome_settings;
create policy "Signed-in users manage welcome settings"
  on public.welcome_settings
  for all
  to authenticated
  using (true)
  with check (true);

-- 2. clients.welcome_sent_at: set (claimed) just before the welcome SMS goes out,
--    so it can never be sent twice. Every client who already exists is marked as
--    welcomed, so only clients added from now on get it. This only happens the
--    first time (when the column is created): running this again never marks
--    newer clients.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients' and column_name = 'welcome_sent_at'
  ) then
    alter table public.clients add column welcome_sent_at timestamptz;
    update public.clients set welcome_sent_at = now();
  end if;
end $$;

-- 3. sms_log.kind: 'welcome' for welcome SMS (the "Boas-vindas" filter in the
--    send history), empty for everything else.
alter table public.sms_log add column if not exists kind text;

-- Used vales are deleted (owner decision, 2026-10-28): "Marcar como usado" removes
-- the vale from the database instead of setting used_at.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- This DELETES every vale already marked as used (step 3). That can't be undone.

-- 1. Birthday vales given, per client and year. The one-birthday-vale-per-year rule
--    used to rely on the vale still being there; this table keeps that record after
--    the vale is used and deleted. Filled automatically by a trigger (step 2).
create table if not exists public.birthday_vales_given (
  client_id uuid not null references public.clients(id) on delete cascade,
  year integer not null,
  created_at timestamptz not null default now(),
  primary key (client_id, year)
);

alter table public.birthday_vales_given enable row level security;

drop policy if exists "Signed-in users manage birthday vales given" on public.birthday_vales_given;
create policy "Signed-in users manage birthday vales given"
  on public.birthday_vales_given
  for all
  to authenticated
  using (true)
  with check (true);

-- Every birthday vale that exists now (used or not) counts.
insert into public.birthday_vales_given (client_id, year)
select distinct client_id, extract(year from valid_from)::integer
from public.discount_codes
where kind = 'birthday' and client_id is not null
on conflict do nothing;

-- 2. Creating a birthday vale records it here in the same step. A second birthday
--    vale for the same client and year fails (primary key), so it's never created
--    and its SMS never goes out.
create or replace function public.record_birthday_vale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'birthday' and new.client_id is not null then
    insert into public.birthday_vales_given (client_id, year)
    values (new.client_id, extract(year from new.valid_from)::integer);
  end if;
  return new;
end;
$$;

drop trigger if exists discount_codes_record_birthday on public.discount_codes;
create trigger discount_codes_record_birthday
  before insert on public.discount_codes
  for each row execute function public.record_birthday_vale();

-- 3. Remove the vales already marked as used.
delete from public.discount_codes where used_at is not null;

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

-- Background sending. Same SQL as supabase/migrations/20261029_background_sending.sql.
create table if not exists public.vale_batches (
  id uuid primary key default gen_random_uuid(),
  sms_text text not null,
  recipients integer not null default 0,
  valid_to date not null,
  sending_until timestamptz,
  finished_at timestamptz,
  send_error text,
  created_at timestamptz not null default now()
);

alter table public.vale_batches enable row level security;

drop policy if exists "Signed-in users manage vale batches" on public.vale_batches;
create policy "Signed-in users manage vale batches"
  on public.vale_batches
  for all
  to authenticated
  using (true)
  with check (true);

-- 2. Which run each vale and each SMS belongs to, so a client is never texted twice.
alter table public.discount_codes add column if not exists batch_id uuid references public.vale_batches(id) on delete set null;
alter table public.sms_log add column if not exists batch_id uuid references public.vale_batches(id) on delete set null;
create index if not exists discount_codes_batch_id_idx on public.discount_codes (batch_id);
create index if not exists sms_log_batch_id_idx on public.sms_log (batch_id);

-- 3. Campaigns: the same "one run at a time" marker, and the last sending problem
--    (shown on the campaign's summary).
alter table public.campaigns add column if not exists sending_until timestamptz;
alter table public.campaigns add column if not exists send_error text;
