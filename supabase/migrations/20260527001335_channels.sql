-- channels within communities
create table channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id) on delete cascade not null,
  name text not null,
  description text,
  position int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- messages within channels
create table messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references channels(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete set null not null,
  content text not null,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table channels enable row level security;
alter table messages enable row level security;

-- channels: active members can read; organizers/mods can create/update/delete
create policy "channels_select" on channels
  for select to authenticated
  using (
    exists (
      select 1 from community_members
      where community_id = channels.community_id
        and user_id = auth.uid()
        and status = 'active'
    )
  );

create policy "channels_insert" on channels
  for insert to authenticated
  with check (is_community_mod(community_id));

create policy "channels_update" on channels
  for update to authenticated
  using (is_community_mod(community_id));

create policy "channels_delete" on channels
  for delete to authenticated
  using (is_community_mod(community_id));

-- messages: active members can read and send; authors can edit; authors/mods can delete
create policy "messages_select" on messages
  for select to authenticated
  using (
    exists (
      select 1 from channels c
      join community_members cm on cm.community_id = c.community_id
      where c.id = messages.channel_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

create policy "messages_insert" on messages
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from channels c
      join community_members cm on cm.community_id = c.community_id
      where c.id = messages.channel_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

create policy "messages_update" on messages
  for update to authenticated
  using (auth.uid() = author_id);

create policy "messages_delete" on messages
  for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from channels c
      where c.id = messages.channel_id
        and is_community_mod(c.community_id)
    )
  );

-- enable realtime for messages
alter publication supabase_realtime add table messages;
