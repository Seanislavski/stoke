-- Per-question public visibility toggle.
-- By default a community's Q&A stays private (only the Question of the Week is exposed
-- to logged-out visitors). This lets a mod flip an individual question public so it can be
-- shared by link (e.g. dropped in Discord) and read without an account.
alter table public.kb_questions
  add column if not exists is_public boolean not null default false;
