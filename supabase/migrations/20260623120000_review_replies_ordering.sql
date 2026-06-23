-- Review management: organizer replies + featured ordering.
-- Additive ALTERs — run after the base 20260623000000_reviews.sql migration.
--   reply_*          : one organizer response per review, public or private.
--                      Public  = shown wherever the review is shown (in-app + preview/landing).
--                      Private = visible only to the review author + community staff.
--   featured_position: order of the featured set on public surfaces (top 6 shown).

alter table reviews
  add column reply_body text,
  add column reply_is_public boolean not null default false,
  add column reply_by uuid references profiles(id) on delete set null,
  add column reply_at timestamptz,
  add column featured_position int not null default 0;

create index reviews_featured_order on reviews(community_id, featured_position) where is_featured;
