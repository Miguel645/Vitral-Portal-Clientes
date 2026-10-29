-- Background sending (2026-10-29): big sends ("Criar vales" with SMS, campaigns) carry on
-- by themselves in the background until everyone has their SMS, with no button to press.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted or changed in existing data: this only ADDS a table and columns.

-- 1. One row per "Criar vales" with SMS: the SMS text and how far the sending got.
--    sending_until: a background run is sending until then (only one at a time).
--    finished_at: everyone who receives messages has their SMS (or the vales expired).
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
