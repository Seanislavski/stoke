-- Stories: members share their own experiences; others reply and can say "me too".
--
-- Decided with Sean 10/13/2026:
--   * a new story waits for a moderator; replies appear immediately (mods can remove)
--   * a story can be posted anonymously: members see "Anonymous member", mods still
--     see who wrote it (so they can moderate and help)
--   * "Me too" is one tap; ONLY the story's author sees the count (no public ranking,
--     keeping the no-upvotes rule)
--   * members-only: never shown on the public preview
--
-- RLS on with NO policies = service-role only (same as qotw_items / discord_captures).
-- Every read and write goes through server code, which is what lets the app hide an
-- anonymous author's identity from everyone but moderators.

begin;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  is_anonymous boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists stories_community_status_idx
  on public.stories(community_id, status, published_at desc);

create table if not exists public.story_replies (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists story_replies_story_idx
  on public.story_replies(story_id, created_at);

create table if not exists public.story_metoo (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

alter table public.stories enable row level security;
alter table public.story_replies enable row level security;
alter table public.story_metoo enable row level security;

commit;

-- Proof (riskiest first). Every row should say true.
select 'stories locked to server' as check, (select relrowsecurity from pg_class where oid = 'public.stories'::regclass) as ok
union all
select 'replies locked to server', (select relrowsecurity from pg_class where oid = 'public.story_replies'::regclass)
union all
select 'me-too locked to server', (select relrowsecurity from pg_class where oid = 'public.story_metoo'::regclass)
union all
select 'no policies on stories', not exists(select 1 from pg_policies where tablename in ('stories', 'story_replies', 'story_metoo'))
union all
select 'one me-too per person', exists(select 1 from pg_constraint where conrelid = 'public.story_metoo'::regclass and contype = 'p');
