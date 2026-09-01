-- Persist the organizer onboarding checklist dismissal.
--
-- Dismissal used to live in localStorage, which made it per-browser and
-- per-device: an organizer who dismissed the box on their laptop still saw it
-- on their phone, and again after clearing site data. This makes the dismissal
-- a property of the community, so it hides once and stays hidden.
--
-- Nullable on purpose: null means "never dismissed", which is the correct
-- default for every existing community and every new one.
alter table public.communities
  add column if not exists onboarding_dismissed_at timestamptz;

comment on column public.communities.onboarding_dismissed_at is
  'When an organizer dismissed the getting-started checklist. Null = never dismissed.';
