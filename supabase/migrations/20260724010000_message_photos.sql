-- Future-proof channel messages for multiple images.
-- Chat messages currently carry a single `image_url`; every other photo-bearing
-- surface (bulletin_posts, events, kb_questions, kb_answers) already uses a
-- `photos text[]`. Add the same array here so a multi-image chat composer can
-- land later with no schema change, and the community Photos aggregate can read
-- both the legacy single url and the array. `image_url` stays for existing rows.

alter table public.messages add column if not exists photos text[] not null default '{}';
