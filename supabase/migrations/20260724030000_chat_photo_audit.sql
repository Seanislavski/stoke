-- Audit chat photos via a DB trigger.
-- Channel messages are inserted client-side (direct insert under RLS, no server
-- action), so there's no server code path to call logPhotos from. A trigger on
-- messages writes photo.added / photo.removed audit_log rows itself, matching the
-- shape the app uses for the other surfaces:
--   metadata = { source:'chat', url, parent_id: <message id>, channel_id }
-- Images live in image_url (legacy single) and/or photos[] (multi-image).

create or replace function public.log_message_photos()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  mid uuid;
  mchan uuid;
  cid uuid;
  actor uuid;
  act text;
  imgs text[];
  u text;
begin
  if TG_OP = 'INSERT' then
    imgs := coalesce(NEW.photos, '{}') || case when NEW.image_url is not null then array[NEW.image_url] else '{}'::text[] end;
    act := 'photo.added';
    actor := NEW.author_id;
    mid := NEW.id; mchan := NEW.channel_id;
  elsif TG_OP = 'UPDATE' then
    -- Soft delete (deleted_at set) → removed; restore (deleted_at cleared) → re-added.
    if OLD.deleted_at is null and NEW.deleted_at is not null then
      act := 'photo.removed'; actor := coalesce(NEW.deleted_by, NEW.author_id);
    elsif OLD.deleted_at is not null and NEW.deleted_at is null then
      act := 'photo.added'; actor := NEW.author_id;
    else
      return NEW;  -- edits that don't change deletion state
    end if;
    imgs := coalesce(NEW.photos, '{}') || case when NEW.image_url is not null then array[NEW.image_url] else '{}'::text[] end;
    mid := NEW.id; mchan := NEW.channel_id;
  else  -- DELETE (hard)
    imgs := coalesce(OLD.photos, '{}') || case when OLD.image_url is not null then array[OLD.image_url] else '{}'::text[] end;
    act := 'photo.removed'; actor := coalesce(OLD.deleted_by, OLD.author_id);
    mid := OLD.id; mchan := OLD.channel_id;
  end if;

  if array_length(imgs, 1) is null then
    return coalesce(NEW, OLD);
  end if;

  select community_id into cid from public.channels where id = mchan;

  foreach u in array imgs loop
    insert into public.audit_log (actor_id, community_id, action, target_id, target_type, metadata)
    values (actor, cid, act, mid, 'photo',
      jsonb_build_object('source', 'chat', 'url', u, 'parent_id', mid, 'channel_id', mchan));
  end loop;

  return coalesce(NEW, OLD);
end;
$func$;

drop trigger if exists trg_message_photos_ins on public.messages;
drop trigger if exists trg_message_photos_upd on public.messages;
drop trigger if exists trg_message_photos_del on public.messages;

create trigger trg_message_photos_ins after insert on public.messages for each row execute function public.log_message_photos();
create trigger trg_message_photos_upd after update on public.messages for each row execute function public.log_message_photos();
create trigger trg_message_photos_del after delete on public.messages for each row execute function public.log_message_photos();
