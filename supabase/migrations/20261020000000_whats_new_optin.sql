-- Opt-in bell notification when a new "What's new" (/changelog) entry ships.
-- notify_whats_new:   the member ticked "Tell me about new features" in profile settings.
-- whats_new_notified: date ('YYYY-MM-DD') of the newest changelog entry they've been told
--                     about, so the cron never sends the same entry twice.

alter table public.profiles
  add column if not exists notify_whats_new boolean not null default false,
  add column if not exists whats_new_notified text;

-- Proof: both rows should say true.
select 'notify_whats_new exists' as check, exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'notify_whats_new'
) as ok
union all
select 'whats_new_notified exists', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'whats_new_notified'
);
