'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const REACTION_RATE_LIMIT = 5
const REACTION_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Notify a message's author that someone reacted — coalesced + throttled so reactions
 * (high-frequency, low-signal) never become noisy:
 *  - never notify yourself,
 *  - at most ONE unread "reaction" notification per message (extra reactions refresh it
 *    silently; the bell only re-pings on INSERT, so an UPDATE is invisible),
 *  - a per-actor hourly cap, mirroring @mentions.
 * Notifications are inserted with the service-role client (notifications has no INSERT policy).
 */
export async function notifyReaction(messageId: string, channelId: string, communityId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()

  const { data: msg } = await admin.from('messages').select('author_id').eq('id', messageId).single()
  if (!msg?.author_id || msg.author_id === user.id) return // no self-notify

  // Coalesce: refresh an existing unread reaction notification for this message silently.
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('user_id', msg.author_id)
    .eq('message_id', messageId)
    .eq('type', 'reaction')
    .is('read_at', null)
    .limit(1)

  if (existing && existing.length > 0) {
    await admin
      .from('notifications')
      .update({ actor_id: user.id, created_at: new Date().toISOString() })
      .eq('id', existing[0].id)
    return
  }

  // Per-actor hourly cap — stops one reactor from pinging across many messages.
  const windowStart = new Date(Date.now() - REACTION_WINDOW_MS).toISOString()
  const { count: recentCount } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', user.id)
    .eq('type', 'reaction')
    .gte('created_at', windowStart)

  if ((recentCount ?? 0) >= REACTION_RATE_LIMIT) return

  await admin.from('notifications').insert({
    user_id: msg.author_id,
    type: 'reaction',
    actor_id: user.id,
    community_id: communityId,
    channel_id: channelId,
    message_id: messageId,
  })
}
