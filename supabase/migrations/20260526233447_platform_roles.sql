create type platform_role as enum ('owner', 'platform_moderator', 'community_manager', 'support');

create table platform_roles (
  user_id uuid references profiles(id) on delete cascade primary key,
  role platform_role not null,
  granted_at timestamptz not null default now()
);

alter table platform_roles enable row level security;

create policy "platform_roles_select" on platform_roles
  for select to authenticated
  using (true);

create policy "platform_roles_insert" on platform_roles
  for insert to authenticated
  with check (
    exists (select 1 from platform_roles where user_id = auth.uid() and role = 'owner')
  );

create policy "platform_roles_delete" on platform_roles
  for delete to authenticated
  using (
    exists (select 1 from platform_roles where user_id = auth.uid() and role = 'owner')
  );
