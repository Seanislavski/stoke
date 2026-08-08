-- Testimonial captures: Discord → Stoke, the reviews edition.
--
-- The Q&A capture pipeline files a captured Discord message as a kb_question or
-- kb_answer authored by the Silas system user with an `attribution` line. This
-- extends the same funnel to `reviews`, so a mod can capture a member praising
-- the community and land it in the testimonials queue.
--
-- ⚠️ THE REASON THE UNIQUE INDEXES ARE REBUILT BELOW.
-- `reviews.author_id` is NOT NULL, so captured testimonials must be authored by
-- someone — and following the Q&A pattern that someone is the Silas system user.
-- But the base migration enforces one review per author per scope:
--     reviews_one_per_author_community (community_id, author_id) where community_id is not null
--     reviews_one_per_author_platform  (author_id)               where community_id is null
-- With Silas as the author on every captured row, the SECOND capture in a scope
-- would violate the index — you would get exactly one captured testimonial ever.
-- Rather than drop a real integrity guarantee, both indexes now additionally
-- require `attribution is null`, which exempts captured rows and leaves the
-- one-per-member rule fully intact for self-authored reviews (every existing row
-- has attribution null, so nothing currently valid becomes invalid).

-- ─── reviews: carry the Discord credit ─────────────────────────────────────────
-- Attribution line rendered in place of the author profile link when present
-- (e.g. 'Shared by Alex on Discord'), matching kb_questions/kb_answers.
alter table public.reviews add column if not exists attribution text;
alter table public.reviews add column if not exists discord_capture_id uuid
  references public.discord_captures(id) on delete set null;

create index if not exists reviews_discord_capture_idx
  on public.reviews(discord_capture_id) where discord_capture_id is not null;

-- Rebuild both uniques to exempt captured (attributed) rows. See the note above.
drop index if exists public.reviews_one_per_author_community;
drop index if exists public.reviews_one_per_author_platform;

create unique index reviews_one_per_author_community
  on public.reviews(community_id, author_id)
  where community_id is not null and attribution is null;

create unique index reviews_one_per_author_platform
  on public.reviews(author_id)
  where community_id is null and attribution is null;

-- ─── discord_captures: what kind of capture is this ────────────────────────────
-- 'qa'          → files into kb_questions / kb_answers (everything captured so far)
-- 'testimonial' → files into reviews
-- Defaulting to 'qa' keeps every existing row and the existing Silas command
-- behaving exactly as before.
alter table public.discord_captures add column if not exists kind text not null default 'qa';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'discord_captures_kind_check'
  ) then
    alter table public.discord_captures
      add constraint discord_captures_kind_check check (kind in ('qa', 'testimonial'));
  end if;
end
$$;

-- Scope the capturing mod picked in Discord: a testimonial about this community,
-- or about Stoke itself. Advisory — the mod confirms it when filing on Stoke.
-- Null for 'qa' captures.
alter table public.discord_captures add column if not exists review_scope text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'discord_captures_review_scope_check'
  ) then
    alter table public.discord_captures
      add constraint discord_captures_review_scope_check
      check (review_scope is null or review_scope in ('community', 'platform'));
  end if;
end
$$;

-- Where it landed (null until a mod files it), mirroring question_id / answer_id.
alter table public.discord_captures add column if not exists review_id uuid
  references public.reviews(id) on delete set null;

-- The testimonials queue: granted, unfiled, not dismissed, kind = testimonial.
create index if not exists discord_captures_kind_idx
  on public.discord_captures(community_id, kind)
  where review_id is null and dismissed_at is null;
