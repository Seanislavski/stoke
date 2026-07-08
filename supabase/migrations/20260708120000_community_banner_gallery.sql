-- More visual space for communities:
--  banner_url : a single wide cover image shown across the top of the page
--  photos     : a gallery of images (reuses the existing PhotoGallery/lightbox)
alter table public.communities
  add column if not exists banner_url text;

alter table public.communities
  add column if not exists photos text[] not null default '{}';
