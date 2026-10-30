-- Faster "Mensagens enviadas" on a client's page (and "Boas-vindas enviada em"): finds a
-- client's latest SMS without reading the whole send history.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Nothing is deleted or changed: this only ADDS an index.

create index if not exists sms_log_client_id_created_at_idx on public.sms_log (client_id, created_at desc);
