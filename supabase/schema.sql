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

-- Login is turned off for now, so visitors without an account need access too.
alter table public.clients enable row level security;

drop policy if exists "Signed-in users manage clients" on public.clients;
drop policy if exists "Anyone can manage clients" on public.clients;
create policy "Anyone can manage clients"
  on public.clients
  for all
  to anon, authenticated
  using (true)
  with check (true);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage', 'fixed')),
  value numeric not null,
  expires_at date,
  max_uses integer,
  times_used integer not null default 0,
  client_id uuid references public.clients(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Login is turned off for now, so visitors without an account need access too.
alter table public.discount_codes enable row level security;

drop policy if exists "Signed-in users manage discount codes" on public.discount_codes;
drop policy if exists "Anyone can manage discount codes" on public.discount_codes;
create policy "Anyone can manage discount codes"
  on public.discount_codes
  for all
  to anon, authenticated
  using (true)
  with check (true);
