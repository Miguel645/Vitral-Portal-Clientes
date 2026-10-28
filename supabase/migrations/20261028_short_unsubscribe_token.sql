-- Short unsubscribe links: /u/<8 characters> instead of /u/<36-character id>.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted or changed in existing data: this only ADDS a column.
-- The old unsubscribe_token column stays, so links in messages already sent
-- (/u/<long id>) keep working.

-- 8 random characters from a-z and 0-9. gen_random_uuid() is cryptographically
-- random, so the tokens can't be guessed. Only fully random bytes of each id are used.
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
