-- Question of the Week: a bank of draft questions + published (numbered) ones.
-- Drafts sit unnumbered until a mod publishes them; publishing assigns the next
-- QotW number for the community and creates the answerable kb_question. Published
-- questions never expire — every QotW-N stays open to answers forever.

create table if not exists public.qotw_items (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  body text,
  number integer,                       -- QotW-N; null while a draft, assigned on publish
  planned_for date,                     -- optional organizational label; does NOT auto-publish
  question_id uuid references public.kb_questions(id) on delete set null,
  position integer not null default 0,  -- ordering of the unpublished bank
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists qotw_items_community_idx on public.qotw_items(community_id);
create unique index if not exists qotw_items_number_uniq
  on public.qotw_items(community_id, number) where number is not null;
create unique index if not exists qotw_items_question_uniq
  on public.qotw_items(question_id) where question_id is not null;

-- All reads/writes go through the service-role admin client (mod-gated in server
-- actions + public numbered pages), so RLS-on with no policy = deny direct client
-- access while service role still works.
alter table public.qotw_items enable row level security;
