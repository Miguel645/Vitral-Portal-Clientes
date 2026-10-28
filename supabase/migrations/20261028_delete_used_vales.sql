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
