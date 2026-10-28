-- Welcome SMS for new clients ("Mensagem de boas-vindas" on Definições).
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted: this only ADDS a table and two columns.

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
