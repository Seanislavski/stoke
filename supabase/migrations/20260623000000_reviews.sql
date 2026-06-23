-- Reviews / Testimonials
-- Members leave reviews; mods approve them (published → visible in-app) and feature a
-- curated few (is_featured → shown publicly on the community preview / landing page).
-- One table serves two scopes via a nullable community_id:
--   community_id NOT NULL → a review of that community
--   community_id NULL     → a platform-level review of Stoke itself
-- Mirrors the kb_* (Q&A) approval pattern: pending reads + all writes go through the
-- service-role admin client in server actions, which verify mod authority.

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid references communities(id) on delete cascade,  -- NULL = platform review
  author_id     uuid references profiles(id) on delete restrict not null,
  rating        int check (rating between 1 and 5),                  -- nullable (optional stars)
  body          text not null,
  status        text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  is_featured   boolean not null default false,
  approved_by   uuid references profiles(id) on delete set null,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index reviews_community_status on reviews(community_id, status);
create index reviews_featured on reviews(community_id, is_featured) where is_featured;

-- One review per author per scope. Partial indexes handle the NULL community_id
-- (platform) case explicitly, since NULLs are distinct in a plain unique constraint.
create unique index reviews_one_per_author_community on reviews(community_id, author_id) where community_id is not null;
create unique index reviews_one_per_author_platform on reviews(author_id) where community_id is null;

create trigger reviews_updated_at
  before update on reviews
  for each row execute function set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────────
-- Members can read published reviews and insert their own; everything else
-- (pending reads, approvals, featuring, edits-as-mod) goes through the admin client.
alter table reviews enable row level security;

create policy "reviews_select" on reviews for select to authenticated using (status = 'published');
create policy "reviews_insert" on reviews for insert to authenticated with check (auth.uid() = author_id);
