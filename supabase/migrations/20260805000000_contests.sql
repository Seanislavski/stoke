-- Design competitions.
--
-- A contest runs through four phases, advanced manually by a mod:
--   draft       -> invisible to members; the brief is still being written
--   submissions -> members enter; every entry queues for mod approval
--   voting      -> mods have picked finalists; members cast one vote each
--   closed      -> winner announced, all approved entries visible, counts revealed
--
-- Entries stay hidden from other members until voting opens, so nobody can copy
-- an early entry and no one gains an advantage by entering first.
--
-- The point of the whole feature is producing a design the community can legally
-- print, so contest_entries.terms_agreed_at is NOT NULL: an entry cannot exist
-- without a recorded licence grant.

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null,
  description text,                     -- the brief, rendered as rich content
  rules text,                           -- shown above the entry form
  terms text not null,                  -- licence text the entrant agrees to
  status text not null default 'draft'
    check (status in ('draft', 'submissions', 'voting', 'closed')),
  submissions_close_at timestamptz,     -- ENFORCED: no entries accepted after this
  voting_close_at timestamptz,          -- advisory label + countdown only
  max_entries_per_member integer not null default 1,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists contests_community_idx
  on public.contests(community_id, status);

create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  -- denormalized so the moderation queue can filter by community without a join,
  -- same reason kb_answers carries community_id
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  photos text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  is_finalist boolean not null default false,
  -- the licence grant; non-null by design, see header
  terms_agreed_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contest_entries_contest_idx
  on public.contest_entries(contest_id, status);
create index if not exists contest_entries_community_pending_idx
  on public.contest_entries(community_id) where status = 'pending';
create index if not exists contest_entries_author_idx
  on public.contest_entries(author_id);

-- One vote per member per contest: the primary key IS the rule. entry_id is
-- merely which entry they chose, so changing a vote is an upsert on the PK.
create table if not exists public.contest_votes (
  contest_id uuid not null references public.contests(id) on delete cascade,
  entry_id uuid not null references public.contest_entries(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contest_id, voter_id)
);

create index if not exists contest_votes_entry_idx
  on public.contest_votes(entry_id);

-- Added after contest_entries exists, since it points at it.
alter table public.contests
  add column if not exists winner_entry_id uuid
  references public.contest_entries(id) on delete set null;

-- Opt-in per community; off by default so no one gets an empty tab they never
-- asked for.
alter table public.communities
  add column if not exists has_contests boolean not null default false;

-- All reads/writes go through the service-role admin client inside mod-gated or
-- membership-gated server actions, exactly like qotw_items and discord_captures.
-- RLS on with no policy = deny direct client access, service role unaffected.
alter table public.contests enable row level security;
alter table public.contest_entries enable row level security;
alter table public.contest_votes enable row level security;
