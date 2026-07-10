-- messages: Discord-style reply — a message can reference another message in the same
-- channel. ON DELETE SET NULL so a hard-deleted parent just clears the reference (soft
-- deletes keep the row, so the quoted reference persists). Nullable + backward-compatible.
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
