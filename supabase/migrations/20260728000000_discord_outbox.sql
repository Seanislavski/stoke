-- Stoke → Discord outbox (drained by the Silas! bot).
--
-- Stoke has no Discord credentials of its own, so when something on the platform
-- needs to reach someone who only exists as a Discord identity, it writes a row
-- here and Silas — who holds the bot token — delivers it as a DM and marks the
-- row done.
--
-- The case that created this: a question filed from an UNCLAIMED Discord capture
-- is authored by the Silas system user, so promoting it to Question of the Week
-- congratulated a bot mailbox while the human who actually wrote it heard
-- nothing. That DM is also the natural moment to nudge them to claim the post.

create table if not exists public.discord_outbox (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,

  kind text not null check (kind in ('qotw_chosen')),
  discord_user_id text not null,                  -- the recipient's Discord id
  payload jsonb not null default '{}',            -- everything the DM needs to render

  -- what this is about (a capture, for every kind that exists today)
  capture_id uuid references public.discord_captures(id) on delete cascade,

  -- delivery bookkeeping, owned by the bot
  attempts int not null default 0,
  last_error text,
  delivered_at timestamptz,
  failed_at timestamptz,                          -- gave up (attempts exhausted)

  created_at timestamptz not null default now()
);

-- One DM per subject per kind: a re-promotion or a retried action can never
-- double-message someone. (capture_id is nullable and NULLs are distinct, so
-- this only constrains capture-linked kinds — which is all of them for now.)
create unique index if not exists discord_outbox_kind_capture_key
  on public.discord_outbox(kind, capture_id)
  where capture_id is not null;

-- The bot's polling query: oldest still-deliverable row first.
create index if not exists discord_outbox_pending_idx
  on public.discord_outbox(created_at)
  where delivered_at is null and failed_at is null;

-- Service-role only (Stoke server actions write, Silas reads + updates), same
-- pattern as discord_captures and qotw_items: RLS on with no policies.
alter table public.discord_outbox enable row level security;
