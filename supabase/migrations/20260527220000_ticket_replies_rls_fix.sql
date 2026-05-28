-- Allow all ticket participants to read all replies on a ticket
-- (not just their own replies — previous policy broke realtime for other party)
drop policy "replies_select" on ticket_replies;

create policy "replies_select" on ticket_replies
  for select to authenticated
  using (
    -- own replies
    author_id = auth.uid()
    -- or ticket submitter
    or exists (
      select 1 from tickets
      where id = ticket_replies.ticket_id
        and submitted_by = auth.uid()
    )
    -- or platform staff
    or exists (
      select 1 from platform_roles
      where user_id = auth.uid()
    )
    -- or community mod/organizer for the ticket's community
    or exists (
      select 1 from tickets t
      join community_members cm on cm.community_id = t.community_id
      where t.id = ticket_replies.ticket_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
        and cm.role in ('organizer', 'moderator')
    )
  );
