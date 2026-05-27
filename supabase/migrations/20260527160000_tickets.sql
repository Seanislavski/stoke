create type ticket_category as enum ('account_issue', 'report_user', 'bug_report', 'community_issue', 'other');
create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');

create table tickets (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references profiles(id) on delete restrict not null,
  category ticket_category not null,
  title text not null,
  status ticket_status not null default 'open',
  community_id uuid references communities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tickets_updated_at
  before update on tickets
  for each row execute function set_updated_at();

create table ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete restrict not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table tickets enable row level security;
alter table ticket_replies enable row level security;

-- Submitter can read/insert their own tickets; all reads handled via admin client
create policy "tickets_select" on tickets for select to authenticated using (submitted_by = auth.uid());
create policy "tickets_insert" on tickets for insert to authenticated with check (submitted_by = auth.uid());

-- Replies: submitter-side insert only; reads via admin client
create policy "replies_select" on ticket_replies for select to authenticated using (author_id = auth.uid());
create policy "replies_insert" on ticket_replies for insert to authenticated with check (author_id = auth.uid());
