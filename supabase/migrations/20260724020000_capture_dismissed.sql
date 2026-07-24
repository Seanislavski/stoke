-- Dismissing a capture without losing its consent record.
-- When a mod deletes captured content (a kb_question/kb_answer that came from a
-- Discord capture), the capture's question_id/answer_id resets to null via the
-- FK ON DELETE SET NULL — which would bounce it back into the "waiting to file"
-- moderation queue. Marking dismissed_at keeps the durable consent record but
-- excludes it from that queue (and the gear badge count), so a deleted capture
-- stays gone instead of reappearing.

alter table public.discord_captures add column if not exists dismissed_at timestamptz;
