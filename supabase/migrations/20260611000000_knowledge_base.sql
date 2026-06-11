-- Knowledge Base: community Q&A
-- Members ask questions and contribute answers; both queue for mod approval.
-- Only published (approved) content is viewable. Organizer-defined categories
-- keep approved questions browsable. Designed to sit beside a future real-time
-- "Ask / I can help" requests feature (separate tables).

-- ─── Categories (organizer-defined) ─────────────────────────────────────────────
create table kb_categories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id) on delete cascade not null,
  name text not null,
  description text,
  position int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index kb_categories_community on kb_categories(community_id);

-- ─── Questions ──────────────────────────────────────────────────────────────────
create table kb_questions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id) on delete cascade not null,
  category_id uuid references kb_categories(id) on delete set null,
  asker_id uuid references profiles(id) on delete restrict not null,
  title text not null,
  body text,
  status text not null default 'pending' check (status in ('published', 'pending', 'rejected')),
  approved_by uuid references profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kb_questions_community_status on kb_questions(community_id, status);
create index kb_questions_category on kb_questions(category_id);

create trigger kb_questions_updated_at
  before update on kb_questions
  for each row execute function set_updated_at();

-- ─── Answers ────────────────────────────────────────────────────────────────────
create table kb_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references kb_questions(id) on delete cascade not null,
  community_id uuid references communities(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete restrict not null,
  body text not null,
  url text,
  status text not null default 'pending' check (status in ('published', 'pending', 'rejected')),
  is_accepted boolean not null default false,
  approved_by uuid references profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kb_answers_question on kb_answers(question_id);
create index kb_answers_community_status on kb_answers(community_id, status);

create trigger kb_answers_updated_at
  before update on kb_answers
  for each row execute function set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────────
-- Reads of pending content + all writes go through the admin (service-role) client
-- in server actions, which verify mod authority. RLS only needs to expose
-- published content to members and let users insert their own submissions.
alter table kb_categories enable row level security;
alter table kb_questions enable row level security;
alter table kb_answers enable row level security;

create policy "kb_categories_select" on kb_categories for select to authenticated using (true);

create policy "kb_questions_select" on kb_questions for select to authenticated using (status = 'published');
create policy "kb_questions_insert" on kb_questions for insert to authenticated with check (auth.uid() = asker_id);

create policy "kb_answers_select" on kb_answers for select to authenticated using (status = 'published');
create policy "kb_answers_insert" on kb_answers for insert to authenticated with check (auth.uid() = author_id);
