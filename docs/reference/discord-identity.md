# Discord identity — handles, sign-in, linking, auto-claim

> Read this before touching Discord auth, `profiles.discord_*`, `handle_new_user`, or the
> capture claim flow. Built 08/06/2026 in one session; every path below was exercised in
> production against real data, including by a member who was not Sean.

Related: `docs/reference/discord-capture-pipeline.md` (how content gets captured in the
first place — this doc is about the *person* behind it).

---

## What exists

| Piece | Where |
|---|---|
| Handle on profile (opt-in) | `profiles.discord_username`, `profiles.show_discord` |
| Discord user id (exact link) | `profiles.discord_user_id` (unique) |
| Per-community display | `communities.show_discord_handles` |
| Sign in with Discord | `components/auth/DiscordSignIn.tsx` (login + signup) |
| Connect/disconnect existing account | `components/settings/LinkDiscord.tsx` |
| Identity read + auto-claim | `app/auth/callback/route.ts` |
| Claim by identity | `claimCapturesForDiscordUser()` in `app/actions/captures.ts` |
| One-time username pick | `app/(app)/welcome/username/page.tsx`, `chooseUsername()` |

Migrations: `20260806000000_discord_handles.sql`, `20260806100000_discord_auth.sql`,
`20260806140000_discord_handle_key.sql`.

---

## ⚠️ Discord's OAuth metadata keys — verified, not assumed

Read off a real signup on 08/06. **There is no `username` and no `preferred_username`.**

```
app_metadata:  {"provider": "discord", "providers": ["discord"]}
user_metadata: full_name     = "junejuno85"                  <- THE HANDLE
               name          = "junejuno85#0"                <- legacy username#discriminator
               custom_claims = {"global_name": "JuneJuno"}   <- DISPLAY name, not the handle
               provider_id   = "847934024999895050"          <- the snowflake
               avatar_url, email, email_verified, iss, picture, sub
```

The first build read `preferred_username` (a GitHub/Keycloak key) in **both** the trigger and
the callback, so `discord_username` came out NULL for every Discord signup. The *username*
was still right only because `full_name` was already in the seed fallback chain.

**It stayed hidden because Sean had typed his handle into Settings by hand hours earlier** —
his account passed every check while carrying the bug. Found by the first real stranger.
Lesson: a field you populated manually cannot test the code that populates it.

---

## The claim payoff (why this exists at all)

`discord_captures.discord_author_id` stores the Discord **user id**. OAuth hands us the same
id. So signing in proves authorship by *identity* rather than by possession of a claim link:
no token to deliver, nothing to type, and it covers every capture at once.

`claimCapturesForDiscordUser(userId, discordUserId)`:
- filters `consent_status in ('granted_credited','granted_anon')` — **pending and declined stay
  unclaimable**
- re-attributes published content exactly as the token path does: `kb_answers.author_id` /
  `kb_questions.asker_id`, `attribution` → null
- audits with `metadata: {via: 'discord-sign-in'}`, so the two claim paths stay distinguishable
- repeats `.is('claimed_by', null)` on the update as a race guard
- runs on **every** sign-in, so linking Discord later needs no special path

Verified live: capture `7f96e555` went from unclaimed to credited at sign-in, and
`kb_questions` "What strange trick helps you start a task?" swapped its "Shared on Discord"
attribution for the member's own profile. Control case: another author's capture stayed
`claimed_by: null` — it claimed exactly what it should and nothing more.

---

## Decisions (deliberate — don't "fix" these)

- **Connecting ≠ showing.** Neither sign-in nor linking ever sets `show_discord`. Publishing
  your handle to other members is a separate act from using Discord to log in.
- **Clearing the handle also clears the opt-in** (`updateProfile`), so a re-added handle is
  never published on the strength of a checkbox ticked months earlier.
- **Disconnecting does NOT un-claim posts.** `clearDiscordLink()` nulls `discord_user_id` and
  forces `show_discord` false, but credit stays — disconnecting a sign-in method is not
  disowning what you wrote. Verified: all 4 captures survived a disconnect.
- **Unlink refuses when Discord is the only identity** (`identities.length < 2`), with a plain
  message rather than Supabase's raw error — otherwise a Discord-only member locks themselves
  out in one click.
- **Handles are only QUERIED when the community shows them** — `memberSelect` in
  `communities/[slug]/page.tsx` is a variable select string. Same rule as contest vote counts:
  fetching then hiding still puts data within reach.
- **A capture's claim is durable; a link is not.** Auto-claim is keyed to the id, so a
  disconnect/reconnect cycle is a no-op (already-claimed rows are filtered out).

---

## `handle_new_user` — rewritten, and it fixed a latent bug

The original derived `username` from `raw_user_meta_data->>'username'` falling back to the
email local part. `profiles.username` is `unique not null`, so **the first collision raised a
unique violation inside the trigger, which failed the `auth.users` insert, which failed the
signup itself** — opaquely. That was already possible for email signups (two people at
`sean@` different domains); OAuth is just what would have started firing it.

Now: `public.derive_username(seed)` strips to `[a-z0-9_]`, lowercases, floors to `member`,
caps at 24 chars, then appends `1, 2, …` while taken — **bounded at 50 tries then random**,
because an unbounded loop in a signup trigger is a hang, not a bug.

**⚠️ Its collision check is case-INSENSITIVE** (`lower(username) = lower(candidate)`). The
first version compared case-sensitively against an already-lowercased candidate, so
`derive_username('Sinaratheus')` returned `sinaratheus` while member `Sinaratheus` existed —
two near-identical identities arrived at automatically. Self-caught before launch; the
`profiles_username_lower_key` unique index now makes it structurally impossible.

`username_chosen` is false only when the name was **derived**, which routes the member to
`/welcome/username` once. Existing rows default `true`, so nobody established is disturbed.

---

## Setup (already done, recorded so it can be repeated)

1. Discord Developer Portal → OAuth2 → **Redirects** → `https://gzssbicdblkmllutegju.supabase.co/auth/v1/callback` → **Save Changes**
2. Supabase → Auth → Providers → Discord → enable + client id/secret
3. "Allow manual linking" is **ON** — required for `linkIdentity()`, i.e. the Settings connect button

**⚠️ `Invalid OAuth2 redirect_uri` is always a Discord-side config problem** — our value is
verifiable with the authorize-endpoint probe in CLAUDE.md. On 08/06 it was **two leading
spaces** in the registered redirect. Both sides looked identical on screen. **Prescribe
delete-and-re-paste, never inspection** — don't make a human be the diff tool.
