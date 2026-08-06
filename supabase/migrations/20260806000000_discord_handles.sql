-- Discord handles: a platform-wide, opt-in profile field that each community
-- can choose to surface in its own member list.
--
-- The field lives on profiles (one handle per person, set once) rather than
-- per-community, because a person has one Discord identity. The per-community
-- switch governs only where it is SHOWN, so a community with no Discord server
-- never displays handles it has no use for.
alter table public.profiles
  add column if not exists discord_username text,
  add column if not exists show_discord boolean not null default false;

alter table public.communities
  add column if not exists show_discord_handles boolean not null default false;

comment on column public.profiles.discord_username is
  'Discord handle, normalized lowercase, no leading @. Visible only when show_discord is true.';
comment on column public.communities.show_discord_handles is
  'When true, member Discord handles appear in this community''s member list.';
