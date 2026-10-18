-- Story captures: Discord → Stoke, the stories edition.
--
-- A third capture kind beside 'qa' and 'testimonial': a mod right-clicks a
-- member's post in Discord → "Capture story", Silas asks the author, and once
-- they consent a mod files it into `stories` from the moderation page (writing
-- the title there, the same way captured questions get theirs).
--
-- Follows the Q&A pattern exactly: the story is authored by the Silas system
-- user with an `attribution` line crediting the Discord author ("a community
-- member" for anonymous consents, which also set is_anonymous). Claiming the
-- capture later reassigns author_id and clears the attribution.
--
-- stories has no unique index on author_id, so — unlike testimonials — nothing
-- needs rebuilding to let Silas author many of them.

begin;

-- ─── stories: carry the Discord credit ─────────────────────────────────────────
-- Rendered in place of the author's profile when present, matching
-- kb_questions / kb_answers / reviews. Null for every self-written story.
alter table public.stories add column if not exists attribution text;

-- ─── discord_captures: allow the new kind ──────────────────────────────────────
-- The constraint was created with an explicit name, so it can be replaced by name.
alter table public.discord_captures drop constraint if exists discord_captures_kind_check;
alter table public.discord_captures
  add constraint discord_captures_kind_check check (kind in ('qa', 'testimonial', 'story'));

-- Where it landed (null until a mod files it), mirroring question_id / answer_id / review_id.
alter table public.discord_captures add column if not exists story_id uuid
  references public.stories(id) on delete set null;

commit;

-- Proof (riskiest first). Every row should say true — 6 rows.
select 'story kind allowed' as check, pg_get_constraintdef(oid) ilike '%story%' as ok
  from pg_constraint where conname = 'discord_captures_kind_check'
union all
select 'old kinds still allowed', (select pg_get_constraintdef(oid) ilike '%qa%' and pg_get_constraintdef(oid) ilike '%testimonial%'
  from pg_constraint where conname = 'discord_captures_kind_check')
union all
select 'stories still locked to server', (select relrowsecurity from pg_class where oid = 'public.stories'::regclass)
union all
select 'captures link to stories', exists(select 1 from pg_constraint where conrelid = 'public.discord_captures'::regclass
  and contype = 'f' and confrelid = 'public.stories'::regclass)
union all
select 'stories.attribution column', exists(select 1 from information_schema.columns where table_name = 'stories' and column_name = 'attribution')
union all
select 'discord_captures.story_id column', exists(select 1 from information_schema.columns where table_name = 'discord_captures' and column_name = 'story_id');
