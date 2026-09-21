-- Community growth milestones (10, 25, 50, 100, 250 … 10,000 members).
--
-- One row per milestone a community has reached, recorded the FIRST time it is
-- crossed. The primary key makes a milestone impossible to record twice, so a
-- community that dips to 99 and climbs back to 100 does not celebrate again,
-- and two page loads racing to record the same crossing produce one row (and
-- one round of organizer notifications).
--
-- RLS on with no policies = service-role only, like qotw_items. The community
-- page reads and writes it through createAdminClient().
create table if not exists public.community_milestones (
  community_id uuid not null references public.communities(id) on delete cascade,
  threshold    integer not null check (threshold > 0),
  reached_at   timestamptz not null default now(),
  -- true for milestones filled in by this migration: they get a colour but no
  -- celebration banner, because they were reached before the feature existed.
  backfilled   boolean not null default false,
  primary key (community_id, threshold)
);

alter table public.community_milestones enable row level security;

comment on table public.community_milestones is
  'Member-count milestones each community has reached. Written on first crossing; never re-celebrated.';

-- Backfill every milestone existing communities have already passed. The date
-- is the join date of the Nth still-active member, the closest honest answer
-- to "when did we reach N" that the data can give.
insert into public.community_milestones (community_id, threshold, reached_at, backfilled)
select r.community_id, t.threshold, r.joined_at, true
from (
  select community_id, joined_at,
         row_number() over (partition by community_id order by joined_at, id) as n
  from public.community_members
  where status = 'active'
) r
join (values (10), (25), (50), (100), (250), (500), (1000), (2500), (5000), (10000)) as t(threshold)
  on r.n = t.threshold
on conflict (community_id, threshold) do nothing;
