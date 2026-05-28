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

  const [{ data: message }, { data: membership }, { data: community }] = await Promise.all([
    admin.from('messages').select('author_id, content').eq('id', messageId).single(),
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
  ])

  if (!message) return { error: 'Message not found' }

  const isAuthor = message.author_id === user.id
  const isOwner = community?.owner_id === user.id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'

  if (!isAuthor && !isMod && !isOwner) return { error: 'Not authorized' }

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

export async function restoreMessage(
  messageId: string,
  channelId: string,
  communityId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const admin = createAdminClient()

  const [{ data: membership }, { data: community }] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
  ])

  const isOwner = community?.owner_id === user.id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'
  if (!isMod && !isOwner) return { error: 'Not authorized' }

  await admin.from('messages').update({ deleted_at: null, deleted_by: null }).eq('id', messageId)

  logAction({ actorId: user.id, communityId, action: 'message.restored', targetId: messageId, targetType: 'message', metadata: { channel_id: channelId } })

  return {}
}
