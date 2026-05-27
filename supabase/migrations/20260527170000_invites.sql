create table invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  community_id uuid references communities(id) on delete cascade not null,
  created_by uuid references profiles(id) on delete restrict not null,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table invites enable row level security;

-- Only organizers/mods manage invites; reads via admin client
create policy "invites_select" on invites for select to authenticated using (true);
create policy "invites_insert" on invites for insert to authenticated with check (created_by = auth.uid());
create policy "invites_delete" on invites for delete to authenticated using (created_by = auth.uid());
