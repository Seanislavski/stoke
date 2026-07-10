-- messages: keep the immediately-previous text so an author can undo their last edit.
-- Single-level undo — on each edit we stash the pre-edit content here; reverting swaps
-- it back and clears it. Nullable + backward-compatible, safe to run before deploy.
alter table public.messages
  add column if not exists previous_content text;
