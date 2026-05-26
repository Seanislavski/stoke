create type bulletin_status as enum ('published', 'pending', 'rejected');

create table bulletin_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete set null,
  title text not null,
  content text not null,
  status bulletin_status not null default 'pending',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bulletin_posts_updated_at
  before update on bulletin_posts
  for each row execute function set_updated_at();

alter table bulletin_posts enable row level security;

-- Members can read published posts; admin client used for pending posts
create policy "bulletin_select" on bulletin_posts
  for select to authenticated
  using (status = 'published');

-- Members can submit posts (membership verified in server action)
create policy "bulletin_insert" on bulletin_posts
  for insert to authenticated
  with check (auth.uid() = author_id);
