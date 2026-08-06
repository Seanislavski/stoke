-- Discord does not send `preferred_username`.
--
-- Verified against a real signup's metadata (2026-08-06):
--   full_name     = "junejuno85"        <- the actual Discord username
--   name          = "junejuno85#0"      <- legacy username#discriminator
--   custom_claims = {"global_name": "JuneJuno"}  <- display name, not the handle
--
-- The original trigger read preferred_username (a GitHub/Keycloak key), so
-- discord_username came out NULL for every Discord signup. The username itself
-- was fine because full_name was already in the seed fallback chain.
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
  discord_handle text;
begin
  -- full_name first, then strip the "#0" off the legacy form as a fallback.
  discord_handle := lower(coalesce(
    nullif(meta->>'preferred_username', ''),
    nullif(meta->>'full_name', ''),
    nullif(split_part(coalesce(meta->>'name', ''), '#', 1), '')
  ));

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
      -- Discord's global_name is the friendly display name, so prefer it here
      -- even though it is the wrong thing for the handle.
      nullif(meta->'custom_claims'->>'global_name', ''),
      nullif(meta->>'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    ),
    nullif(meta->>'avatar_url', ''),
    case when is_discord then nullif(meta->>'provider_id', '') end,
    case when is_discord then discord_handle end,
    explicit_username is not null
  );

  return new;
end;
$func$;

-- Backfill the one account that signed up before this fix. Safe to re-run:
-- only touches Discord-linked profiles that still have no handle.
update public.profiles p
set discord_username = lower(coalesce(
      nullif(u.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(u.raw_user_meta_data->>'name', ''), '#', 1), '')
    ))
from auth.users u
where u.id = p.id
  and p.discord_user_id is not null
  and p.discord_username is null;
