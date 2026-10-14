-- Follows: a member follows a question or a story and gets a bell notification
-- when it gets a new published answer (question) or a new reply (story).
--
-- Decided 10/14/2026:
--   * you follow automatically when you ask or answer a question, or reply to a story;
--     anyone can follow or unfollow with a button on the page
--   * bell only, no email
--   * a story's author is not stored here: they already get a 'story_reply' notification
--
-- One row per (person, thing). Two nullable FK columns instead of a generic target_id,
-- so deleting a question or story removes its follows (on delete cascade).
-- RLS on with NO policies = service-role only (same as stories / qotw_items).

begin;

create table if not exists public.follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  question_id uuid references public.kb_questions(id) on delete cascade,
  story_id uuid references public.stories(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_one_target check (num_nonnulls(question_id, story_id) = 1)
);

create unique index if not exists follows_user_question_key
  on public.follows(user_id, question_id) where question_id is not null;
create unique index if not exists follows_user_story_key
  on public.follows(user_id, story_id) where story_id is not null;
create index if not exists follows_question_idx on public.follows(question_id) where question_id is not null;
create index if not exists follows_story_idx on public.follows(story_id) where story_id is not null;

alter table public.follows enable row level security;

commit;

-- Proof (riskiest first). Every row should say true.
select 'follows locked to server' as check, (select relrowsecurity from pg_class where oid = 'public.follows'::regclass) as ok
union all
select 'no policies on follows', not exists(select 1 from pg_policies where tablename = 'follows')
union all
select 'exactly one target per row', exists(select 1 from pg_constraint where conname = 'follows_one_target')
union all
select 'one follow per question', exists(select 1 from pg_indexes where indexname = 'follows_user_question_key')
union all
select 'one follow per story', exists(select 1 from pg_indexes where indexname = 'follows_user_story_key');
