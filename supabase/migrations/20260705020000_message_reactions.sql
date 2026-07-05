-- Emoji reactions on channel messages (Plish-style).
-- channel_id is denormalized so the realtime client can filter reaction changes by channel
-- (the messages table isn't reachable from a postgres_changes filter on this table).
create table message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade not null,
  channel_id uuid references channels(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index message_reactions_message_id_idx on message_reactions(message_id);

alter table message_reactions enable row level security;

-- Active members of the channel's community can read reactions (mirrors messages_select).
create policy "message_reactions_select" on message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from channels c
      join community_members cm on cm.community_id = c.community_id
      where c.id = message_reactions.channel_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

-- Members can add their own reactions.
create policy "message_reactions_insert" on message_reactions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from channels c
      join community_members cm on cm.community_id = c.community_id
      where c.id = message_reactions.channel_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

-- Users can remove their own reactions.
create policy "message_reactions_delete" on message_reactions
  for delete to authenticated
  using (auth.uid() = user_id);

-- REPLICA IDENTITY FULL so realtime DELETE payloads carry channel_id/message_id/emoji
-- (default only ships the primary key), letting clients drop the un-reacted row + filter.
alter table message_reactions replica identity full;

alter publication supabase_realtime add table message_reactions;
