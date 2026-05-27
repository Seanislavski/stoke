create table events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id) on delete cascade not null,
  created_by uuid references profiles(id) on delete restrict not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_type text not null default 'online' check (location_type in ('online', 'in_person', 'hybrid')),
  location_online text,
  location_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger events_updated_at
  before update on events
  for each row execute function set_updated_at();

create table event_rsvps (
  event_id uuid references events(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  status text not null check (status in ('yes', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create trigger event_rsvps_updated_at
  before update on event_rsvps
  for each row execute function set_updated_at();

alter table events enable row level security;
alter table event_rsvps enable row level security;

-- Events: all authenticated users can read (app-level gating handles member check)
create policy "events_select" on events for select to authenticated using (true);

-- RSVPs: users manage their own rows; all authenticated can read
create policy "rsvps_select" on event_rsvps for select to authenticated using (true);
create policy "rsvps_insert" on event_rsvps for insert to authenticated with check (auth.uid() = user_id);
create policy "rsvps_update" on event_rsvps for update to authenticated using (auth.uid() = user_id);
create policy "rsvps_delete" on event_rsvps for delete to authenticated using (auth.uid() = user_id);
