-- Discord sign-in.
--
-- Two things happen here:
--
-- 1. profiles gains the Discord USER ID (not just the handle). discord_captures
--    keys on discord_author_id, so an exact id is what makes claiming automatic
--    and provable. Handles change; ids do not.
--
-- 2. handle_new_user() is rewritten to survive OAuth signups. The old version
--    derived the username from raw_user_meta_data->>'username' (absent for
--    OAuth) falling back to the email local part — and profiles.username is
--    UNIQUE NOT NULL, so the first collision raised a unique violation, which
--    failed the auth.users insert, which failed the sign-in itself. That was a
--    latent bug for email signups too; Discord is what would start firing it.

alter table public.profiles
  add column if not exists discord_user_id text unique,
  -- False when we derived the username instead of the person choosing it, which
  -- is what sends OAuth signups through the pick-a-username step once.
  add column if not exists username_chosen boolean not null default true;

comment on column public.profiles.discord_user_id is
  'Discord snowflake id from OAuth. Exact link to discord_captures.discord_author_id.';
comment on column public.profiles.username_chosen is
  'False for auto-derived usernames (OAuth signups) until the member picks one.';

-- Collision-safe username derivation, shared by every signup path.
create or replace function public.derive_username(seed text)
returns text language plpgsql security definer
set search_path = public
as $func$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(seed, ''), '[^a-zA-Z0-9_]', '', 'g'));
  if base = '' then base := 'member'; end if;
  if length(base) > 24 then base := left(base, 24); end if;

  candidate := base;
  -- Case-INSENSITIVE collision check. The unique index on username is
  -- case-sensitive and profile lookups use .eq(), so "Sinaratheus" and
  -- "sinaratheus" would both be allowed and resolve to different profiles —
  -- two near-identical identities, arrived at automatically. Matches the
  -- ilike check in chooseUsername().
  -- Bounded: after 50 tries stop guessing and use randomness, so a pathological
  -- prefix can never spin here and hang a signup.
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    if n > 50 then
      candidate := base || floor(random() * 1000000)::text;
    else
      candidate := base || n::text;
    end if;
  end loop;

  return candidate;
end;
$func$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $func$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
  explicit_username text := nullif(meta->>'username', '');
  seed text;
  is_discord boolean := provider = 'discord';
begin
  -- Preference order: what they typed at signup, then what the provider calls
  -- them, then the email local part. Never null — derive_username floors it.
  seed := coalesce(
    explicit_username,
    nullif(meta->>'preferred_username', ''),
    nullif(meta->>'user_name', ''),
    nullif(meta->>'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), '')
  );

  insert into public.profiles (
    id, username, display_name, avatar_url,
    discord_user_id, discord_username, username_chosen
  )
  values (
    new.id,
    public.derive_username(seed),
    coalesce(
      nullif(meta->>'display_name', ''),
      nullif(meta->>'full_name', ''),
      nullif(meta->>'preferred_username', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    ),
    nullif(meta->>'avatar_url', ''),
    case when is_discord then nullif(meta->>'provider_id', '') end,
    case when is_discord then lower(nullif(meta->>'preferred_username', '')) end,
    -- Typing a username at signup counts as choosing it. A derived one does not.
    explicit_username is not null
  );

  return new;
end;
$func$;

-- Note: show_discord deliberately stays FALSE even for Discord signups. Signing
-- in with Discord is not the same act as publishing your handle to other members.
