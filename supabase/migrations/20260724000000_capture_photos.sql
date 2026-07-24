-- Photos in the Discord → Stoke capture pipeline.
-- Discord CDN attachment URLs are signed and expire (~24h), so the Silas bot
-- downloads image attachments at capture time and re-uploads them to Stoke's
-- `avatars` storage bucket (path `discord-captures/...`), storing the durable
-- public URLs here. When a mod files a capture into the Q&A library, the photos
-- travel onto the resulting question or answer (same `text[]` pattern as
-- bulletin_posts.photos / events.photos).

alter table public.discord_captures add column if not exists photos text[] not null default '{}';
alter table public.kb_questions     add column if not exists photos text[] not null default '{}';
alter table public.kb_answers       add column if not exists photos text[] not null default '{}';
