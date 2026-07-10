'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logAction } from '@/lib/audit'

export async function deleteMessage(
  messageId: string,
  channelId: string,
  communityId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const admin = createAdminClient()

  const [{ data: message }, { data: membership }, { data: community }, { data: platformRole }] = await Promise.all([
    admin.from('messages').select('author_id, content').eq('id', messageId).single(),
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])

  if (!message) return { error: 'Message not found' }

  const isAuthor = message.author_id === user.id
  const isOwner = community?.owner_id === user.id
  const isPlatformStaff = !!platformRole
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'

  if (!isAuthor && !isMod && !isOwner && !isPlatformStaff) return { error: 'Not authorized' }

  await admin.from('messages').update({ deleted_at: new Date().toISOString(), deleted_by: user.id }).eq('id', messageId)

  logAction({
    actorId: user.id,
    communityId,
    action: 'message.deleted',
    targetUserId: message.author_id,
    targetId: messageId,
    targetType: 'message',
    metadata: { content: message.content, self: isAuthor, channel_id: channelId },
  })

  return {}
}

export async function editMessage(
  messageId: string,
  channelId: string,
  communityId: string,
  content: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const trimmed = content.trim()

  const admin = createAdminClient()
  const { data: message } = await admin
    .from('messages')
    .select('author_id, content, image_url, deleted_at')
    .eq('id', messageId)
    .single()

  if (!message) return { error: 'Message not found' }
  if (message.deleted_at) return { error: 'Cannot edit a deleted message' }
  // Author-only: mods can delete a message but not reword someone else's words.
  if (message.author_id !== user.id) return { error: 'Not authorized' }
  // Don't allow emptying a text-only message (image-only messages may have empty text).
  if (!trimmed && !message.image_url) return { error: 'Message cannot be empty' }
  if (trimmed === message.content) return {} // no-op

  await admin
    .from('messages')
    // Stash the pre-edit text so the author can undo this one edit (single level).
    .update({ content: trimmed, edited_at: new Date().toISOString(), previous_content: message.content })
    .eq('id', messageId)

  logAction({
    actorId: user.id,
    communityId,
    action: 'message.edited',
    targetId: messageId,
    targetType: 'message',
    // Keep the before/after so the audit trail shows what actually changed.
    metadata: { channel_id: channelId, before: message.content, after: trimmed },
  })

  return {}
}

export async function revertMessage(
  messageId: string,
  channelId: string,
  communityId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: message } = await admin
    .from('messages')
    .select('author_id, content, previous_content, deleted_at')
    .eq('id', messageId)
    .single()

  if (!message) return { error: 'Message not found' }
  if (message.deleted_at) return { error: 'Cannot revert a deleted message' }
  // Author-only — same rule as editing.
  if (message.author_id !== user.id) return { error: 'Not authorized' }
  if (message.previous_content == null) return { error: 'Nothing to undo' }

  await admin
    .from('messages')
    // Restore the prior text and clear the stash — single-level undo, so no second undo
    // until the next edit.
    .update({ content: message.previous_content, edited_at: new Date().toISOString(), previous_content: null })
    .eq('id', messageId)

  logAction({
    actorId: user.id,
    communityId,
    action: 'message.reverted',
    targetId: messageId,
    targetType: 'message',
    metadata: { channel_id: channelId, before: message.content, after: message.previous_content },
  })

  return {}
}

export async function restoreMessage(
  messageId: string,
  channelId: string,
  communityId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const admin = createAdminClient()

  const [{ data: membership }, { data: community }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ])

  const isOwner = community?.owner_id === user.id
  const isPlatformStaff = ['owner', 'platform_moderator'].includes(platformRole?.role ?? '')
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'
  if (!isMod && !isOwner && !isPlatformStaff) return { error: 'Not authorized' }

  await admin.from('messages').update({ deleted_at: null, deleted_by: null }).eq('id', messageId)

  logAction({ actorId: user.id, communityId, action: 'message.restored', targetId: messageId, targetType: 'message', metadata: { channel_id: channelId } })

  return {}
}
