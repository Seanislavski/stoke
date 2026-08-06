-- Usernames: case-insensitive identity.
--
-- profiles.username is stored as typed and looked up with .eq(), so
-- /profile/sean 404s while /profile/Sean works — the same class of broken
-- shared link as the community slugs, but it can't be fixed by lowercasing the
-- URL: 43 of 82 existing members legitimately have capitals.
--
-- A generated lowercase column gives an exact key to query (no LIKE wildcards,
-- which matter here because usernames may contain '_'), and the unique index
-- makes it impossible for two accounts to differ only by case — closing the
-- impersonation gap in the database rather than trusting app code to keep
-- checking. Verified safe: zero case-collisions across all 82 profiles.
alter table public.profiles
  add column if not exists username_lower text
    generated always as (lower(username)) stored;

create unique index if not exists profiles_username_lower_key
  on public.profiles (username_lower);

comment on column public.profiles.username_lower is
  'Generated lowercase username. Query key for case-insensitive lookup; unique.';
