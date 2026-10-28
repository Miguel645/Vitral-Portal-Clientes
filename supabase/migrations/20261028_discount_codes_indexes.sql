-- Faster vale lists: a client's vales (client page) and the newest vales first (/codes).
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted or changed in existing data: this only ADDS two indexes.

create index if not exists discount_codes_client_id_idx on public.discount_codes (client_id);
create index if not exists discount_codes_created_at_idx on public.discount_codes (created_at desc);
