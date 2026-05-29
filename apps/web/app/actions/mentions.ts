'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MENTION_RATE_LIMIT = 5
const MENTION_WINDOW_MS = 60 * 60 * 1000 // 1 hour

export async function processMentions(
  content: string,
  messageId: string,
  channelId: string,
  communityId: string,
): Promise<void> {
  const matches = [...content.matchAll(/@(\w+)/g)].map(m => m[1])
  if (matches.length === 0) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()

  // Rate limit: max 5 mention notifications sent per hour
  const windowStart = new Date(Date.now() - MENTION_WINDOW_MS).toISOString()
  const { count: recentCount } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', user.id)
    .eq('type', 'mention')
    .gte('created_at', windowStart)

  if ((recentCount ?? 0) >= MENTION_RATE_LIMIT) return

  // Resolve unique @usernames to profile IDs (case-insensitive)
  const unique = [...new Set(matches.map(m => m.toLowerCase()))]
  const { data: mentioned } = await admin
    .from('profiles')
    .select('id, username')
    .or(unique.map(u => `username.ilike.${u}`).join(','))

  if (!mentioned?.length) return

  // Only notify active community members (not self)
  const candidateIds = mentioned.map(p => p.id).filter(id => id !== user.id)
  if (!candidateIds.length) return

  const { data: members } = await admin
    .from('community_members')
    .select('user_id')
    .eq('community_id', communityId)
    .in('user_id', candidateIds)
    .eq('status', 'active')

  if (!members?.length) return

  for (const member of members) {
    // Dedup: skip if unread mention from same actor in same channel already exists
    const { count: existing } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', member.user_id)
      .eq('actor_id', user.id)
      .eq('channel_id', channelId)
      .eq('type', 'mention')
      .is('read_at', null)

    if ((existing ?? 0) > 0) continue

    await admin.from('notifications').insert({
      user_id: member.user_id,
      type: 'mention',
      actor_id: user.id,
      community_id: communityId,
      channel_id: channelId,
      message_id: messageId,
    })
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
}
