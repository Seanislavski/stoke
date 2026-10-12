-- Let the Stoke -> Discord outbox carry CHANNEL posts, not just DMs.
--
-- New kind 'qotw_published': when a Featured Question goes live, Stoke queues an
-- announcement and Silas posts it in the server's General channel. A channel post
-- has no recipient, so discord_user_id becomes nullable (DMs still require it),
-- and the row points at the question instead of a capture.

begin;

alter table public.discord_outbox
  alter column discord_user_id drop not null;

alter table public.discord_outbox
  add column if not exists question_id uuid references public.kb_questions(id) on delete cascade;

-- Replace the kind check (its name was auto-generated, so find it rather than guess).
do $do$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.discord_outbox'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.discord_outbox drop constraint %I', c);
  end loop;
end
$do$;

alter table public.discord_outbox
  add constraint discord_outbox_kind_check
  check (kind in ('qotw_chosen', 'qotw_published'));

-- A DM still needs someone to send it to.
alter table public.discord_outbox
  add constraint discord_outbox_dm_recipient_check
  check (kind <> 'qotw_chosen' or discord_user_id is not null);

-- One announcement per question: a retried publish can never post twice.
create unique index if not exists discord_outbox_kind_question_key
  on public.discord_outbox(kind, question_id)
  where question_id is not null;

commit;

-- Proof (riskiest first). Every row should say true.
select 'new kind allowed' as check, pg_get_constraintdef(oid) ilike '%qotw_published%' as ok
  from pg_constraint where conname = 'discord_outbox_kind_check'
union all
select 'dm recipient still required', exists(select 1 from pg_constraint where conname = 'discord_outbox_dm_recipient_check')
union all
select 'one post per question', exists(select 1 from pg_indexes where indexname = 'discord_outbox_kind_question_key')
union all
select 'question_id column', exists(select 1 from information_schema.columns where table_name = 'discord_outbox' and column_name = 'question_id')
union all
select 'user id now optional', (select is_nullable = 'YES' from information_schema.columns where table_name = 'discord_outbox' and column_name = 'discord_user_id');
