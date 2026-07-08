-- Long-form "About this community" text, separate from the short one-line
-- description (which stays the tagline used in directory cards + header).
alter table public.communities
  add column if not exists about text;
