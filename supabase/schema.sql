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

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric not null check (amount > 0),
  purchased_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

drop policy if exists "Anyone can manage purchases" on public.purchases;
drop policy if exists "Signed-in users manage purchases" on public.purchases;
create policy "Signed-in users manage purchases"
  on public.purchases
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  earn_from date not null,
  earn_to date not null,
  min_spend numeric not null check (min_spend > 0),
  discount_percent numeric not null check (discount_percent >= 1 and discount_percent <= 100),
  reward_valid_from date not null,
  reward_valid_to date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promotions_earn_window check (earn_from <= earn_to),
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
  kind text not null check (kind in ('birthday', 'spend')),
  percent numeric not null check (percent >= 1 and percent <= 100),
  client_id uuid references public.clients(id) on delete set null,
  promotion_id uuid references public.promotions(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
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

-- At most one reward code per purchase per promotion.
create unique index if not exists discount_codes_one_per_purchase_promotion
  on public.discount_codes (purchase_id, promotion_id)
  where kind = 'spend' and purchase_id is not null;

alter table public.discount_codes enable row level security;

drop policy if exists "Anyone can manage discount codes" on public.discount_codes;
drop policy if exists "Signed-in users manage discount codes" on public.discount_codes;
create policy "Signed-in users manage discount codes"
  on public.discount_codes
  for all
  to authenticated
  using (true)
  with check (true);
