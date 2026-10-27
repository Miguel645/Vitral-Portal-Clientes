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

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  condition text,
  discount_percent numeric not null check (discount_percent >= 1 and discount_percent <= 100),
  reward_valid_from date not null,
  reward_valid_to date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promotions_reward_window check (reward_valid_from <= reward_valid_to)
);

alter table public.promotions enable row level security;

drop policy if exists "Anyone can manage promotions" on public.promotions;
drop policy if exists "Signed-in users manage promotions" on public.promotions;
create policy "Signed-in users manage promotions"
  on public.promotions
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('birthday', 'promotion')),
  percent numeric not null check (percent >= 1 and percent <= 100),
  client_id uuid references public.clients(id) on delete set null,
  promotion_id uuid references public.promotions(id) on delete set null,
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

-- 'spend' vales are now just called 'promotion' vales (no purchase_id left).
update public.discount_codes set kind = 'promotion' where kind = 'spend';

alter table public.discount_codes drop constraint if exists discount_codes_kind_check;
alter table public.discount_codes add constraint discount_codes_kind_check
  check (kind in ('birthday', 'promotion'));

-- Promotions are now simple vale templates: no earn window or minimum spend,
-- just a plain-text condition shown to staff (not enforced by the app).
alter table public.promotions drop constraint if exists promotions_earn_window;
alter table public.promotions drop column if exists earn_from;
alter table public.promotions drop column if exists earn_to;
alter table public.promotions drop column if exists min_spend;
alter table public.promotions add column if not exists condition text;
