create table resources (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id) on delete cascade not null,
  submitted_by uuid references profiles(id) on delete restrict not null,
  title text not null,
  description text,
  url text not null,
  resource_type text not null default 'other' check (resource_type in ('article', 'video', 'tool', 'book', 'other')),
  status text not null default 'pending' check (status in ('published', 'pending', 'rejected')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger resources_updated_at
  before update on resources
  for each row execute function set_updated_at();

alter table resources enable row level security;

create policy "resources_select" on resources for select to authenticated using (true);
create policy "resources_insert" on resources for insert to authenticated with check (auth.uid() = submitted_by);
