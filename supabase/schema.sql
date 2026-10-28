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
