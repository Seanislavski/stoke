-- Asker's public-sharing preference, captured on the ask form (a checkbox, checked by
-- default). This is only a SIGNAL to moderators — actual public visibility stays the
-- mod-controlled kb_questions.is_public toggle. NULL = no preference recorded (questions
-- created before this column existed).
alter table public.kb_questions
  add column if not exists asker_public_pref boolean;
