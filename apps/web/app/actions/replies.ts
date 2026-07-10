'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const REPLY_RATE_LIMIT = 5
const REPLY_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Notify the author of the message being replied to. Skips self-replies, only pings
 * active community members, and caps at 5 reply notifications per actor per hour
 * (same low-noise pattern as mentions).
 */
export async function notifyReply(
  replyMessageId: string,
  replyToId: string,
  channelId: string,
  communityId: string,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()

  const { data: parent } = await admin
    .from('messages')
    .select('author_id')
    .eq('id', replyToId)
    .single()

  if (!parent || parent.author_id === user.id) return // don't ping yourself

  // Only notify active members of this community.
  const { data: membership } = await admin
    .from('community_members')
    .select('user_id')
    .eq('community_id', communityId)
    .eq('user_id', parent.author_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!membership) return

  // Rate limit: max 5 reply notifications sent per hour.
  const windowStart = new Date(Date.now() - REPLY_WINDOW_MS).toISOString()
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', user.id)
    .eq('type', 'reply')
    .gte('created_at', windowStart)
  if ((count ?? 0) >= REPLY_RATE_LIMIT) return

  await admin.from('notifications').insert({
    user_id: parent.author_id,
    type: 'reply',
    actor_id: user.id,
    community_id: communityId,
    channel_id: channelId,
    message_id: replyMessageId,
  })
}
