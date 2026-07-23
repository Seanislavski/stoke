-- Discord → Stoke capture pipeline (Silas! bot).
-- A mod captures a valuable Discord message; the bot asks the author for consent
-- (credited / anonymous / no) via DM buttons; granted captures are filed into the
-- Q&A knowledge base from the Stoke moderation page, authored by the Silas system
-- user with an attribution line. A claim token lets the original author sign up
-- later and re-attribute the content to their real Stoke profile.

create table if not exists public.discord_captures (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,

  -- provenance
  discord_message_id text not null unique,       -- dedup: a message can only be captured once
  discord_channel_id text not null,
  discord_guild_id text not null,
  discord_message_url text not null,

  -- author (Discord identity — may never have a Stoke account)
  discord_author_id text not null,
  discord_author_name text not null,

  content text not null,                          -- snapshot at capture time
  captured_by_discord_id text not null,           -- which mod invoked the capture

  -- the recorded-consent core
  consent_status text not null default 'pending'
    check (consent_status in ('pending', 'granted_credited', 'granted_anon', 'declined')),
  consent_asked_at timestamptz,
  consent_answered_at timestamptz,

  -- funnel: token sent only to the author's Discord DM/mention; possession = proof
  claim_token text unique default replace(gen_random_uuid()::text, '-', ''),
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,

  -- where it landed in the KB (null until a mod files it on Stoke)
  question_id uuid references public.kb_questions(id) on delete set null,
  answer_id uuid references public.kb_answers(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists discord_captures_community_idx
  on public.discord_captures(community_id);
create index if not exists discord_captures_author_idx
  on public.discord_captures(discord_author_id);

-- All access via the service-role client (Silas bot + Stoke server actions), so
-- RLS-on with no policies = deny direct client access (same pattern as qotw_items).
alter table public.discord_captures enable row level security;

-- Attribution line rendered in place of the author profile link when present
-- (e.g. 'Shared by Alex on Discord'). Set on captured content authored by the
-- Silas system user; cleared when the original author claims the content.
alter table public.kb_answers   add column if not exists attribution text;
alter table public.kb_questions add column if not exists attribution text;
