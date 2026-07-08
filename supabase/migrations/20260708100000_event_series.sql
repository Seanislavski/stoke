-- Recurring events. A series holds the recurrence rule + a template of the
-- event fields; individual occurrences are materialized as normal rows in
-- `events` (so RSVPs, reminders, display all keep working unchanged). A rolling
-- horizon of occurrences is generated up front and topped up by the existing
-- event-reminder cron, so "until I turn it off" series stay perpetually filled.
create table if not exists public.event_series (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  -- event template
  title text not null,
  description text,
  location_type text not null,
  location_online text,
  location_address text,
  photos text[] not null default '{}',
  tz text not null default 'America/New_York',
  -- recurrence rule
  frequency text not null,                -- 'weekly' | 'biweekly' | 'monthly'
  start_wall text not null,               -- first occurrence wall time 'YYYY-MM-DDTHH:mm'
  duration_minutes integer,               -- null = no end time
  end_type text not null,                 -- 'count' | 'until' | 'never'
  occurrence_count integer,               -- for end_type='count'
  until_date date,                        -- for end_type='until' (inclusive)
  -- generation bookkeeping
  generated_count integer not null default 0,  -- occurrences created so far (= next index)
  active boolean not null default true,         -- false once fully generated / turned off
  created_at timestamptz not null default now()
);

-- Service-role only (all reads/writes go through the admin client), mirroring qotw_items.
alter table public.event_series enable row level security;

-- Link occurrences back to their series. set null on delete so deleting a
-- series can optionally leave past occurrences standing.
alter table public.events
  add column if not exists series_id uuid references public.event_series(id) on delete set null;

-- Denormalized frequency label for display (avoids a join per event card).
alter table public.events
  add column if not exists recurrence text;

create index if not exists events_series_id_idx on public.events(series_id);
create index if not exists event_series_active_idx on public.event_series(active);
