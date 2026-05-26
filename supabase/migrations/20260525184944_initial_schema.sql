-- profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  show_memberships boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $func$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$func$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  is_approved boolean not null default true,
  proposed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- seed a starter set of categories
insert into categories (name, slug) values
  ('Support & Mutual Aid', 'support-mutual-aid'),
  ('Learning & Education', 'learning-education'),
  ('Arts & Creativity', 'arts-creativity'),
  ('Health & Wellness', 'health-wellness'),
  ('Neighborhood & Local', 'neighborhood-local'),
  ('Hobbies & Interests', 'hobbies-interests'),
  ('Professional & Career', 'professional-career'),
  ('Faith & Spirituality', 'faith-spirituality'),
  ('Social & Friendship', 'social-friendship'),
  ('Activism & Advocacy', 'activism-advocacy');

-- communities
create type join_mode as enum ('open', 'request', 'invite_only');

create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  join_mode join_mode not null default 'open',
  is_listed boolean not null default true,
  category_id uuid references categories(id) on delete set null,
  owner_id uuid references profiles(id) on delete restrict not null,
  avatar_url text,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger communities_updated_at
  before update on communities
  for each row execute function set_updated_at();

-- community_members
create type member_role as enum ('organizer', 'moderator', 'member');
create type member_status as enum ('active', 'pending', 'banned', 'timed_out');

create table community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  role member_role not null default 'member',
  status member_status not null default 'active',
  joined_at timestamptz not null default now(),
  unique (community_id, user_id)
);

-- auto-add owner as organizer when community is created
create or replace function public.handle_new_community()
returns trigger language plpgsql security definer
set search_path = public
as $func$
begin
  insert into public.community_members (community_id, user_id, role, status)
  values (new.id, new.owner_id, 'organizer', 'active');
  return new;
end;
$func$;

create trigger on_community_created
  after insert on communities
  for each row execute function handle_new_community();

-- RLS
alter table profiles enable row level security;
alter table categories enable row level security;
alter table communities enable row level security;
alter table community_members enable row level security;

-- profiles: anyone authenticated can read; only owner can update
create policy "profiles_select" on profiles for select to authenticated using (true);
create policy "profiles_update" on profiles for update to authenticated using (auth.uid() = id);

-- categories: anyone authenticated can read approved ones; users can propose new ones
create policy "categories_select" on categories for select to authenticated using (is_approved = true);
create policy "categories_insert" on categories for insert to authenticated with check (auth.uid() = proposed_by and is_approved = false);

-- communities: listed ones visible to all authenticated; unlisted only to members + owner
create policy "communities_select" on communities
  for select to authenticated
  using (
    is_listed = true
    or owner_id = auth.uid()
    or exists (
      select 1 from community_members
      where community_id = communities.id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "communities_insert" on communities
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "communities_update" on communities
  for update to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from community_members
      where community_id = communities.id
        and user_id = auth.uid()
        and role in ('organizer', 'moderator')
        and status = 'active'
    )
  );

-- security definer helper: check if caller is organizer/mod (bypasses RLS, prevents recursion)
create or replace function public.is_community_mod(p_community_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $func$
  select exists (
    select 1 from community_members
    where community_id = p_community_id
      and user_id = auth.uid()
      and role in ('organizer', 'moderator')
      and status = 'active'
  );
$func$;

-- community_members: users see only their own rows (admin client used for full member lists)
create policy "members_select" on community_members
  for select to authenticated
  using (user_id = auth.uid());

create policy "members_insert" on community_members
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "members_update" on community_members
  for update to authenticated
  using (is_community_mod(community_id));

create policy "members_delete" on community_members
  for delete to authenticated
  using (user_id = auth.uid() or is_community_mod(community_id));
