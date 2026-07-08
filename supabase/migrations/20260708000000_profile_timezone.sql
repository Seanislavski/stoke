-- Per-user timezone preference. Events are stored as UTC instants and shown to
-- each viewer in their own timezone. Default is ET; auto-detected from the
-- browser on first visit (timezone_detected flips true once set from any source).
alter table public.profiles
  add column if not exists timezone text not null default 'America/New_York';

alter table public.profiles
  add column if not exists timezone_detected boolean not null default false;
