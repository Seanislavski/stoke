// Following a question or a story. Server-only (service role): the follows table
// has RLS on and no policies, so nobody can see who follows what.

import { createAdminClient } from '@/lib/supabase/admin'

export type FollowTarget = { kind: 'question' | 'story'; id: string }

function column(target: FollowTarget) {
  return target.kind === 'question' ? 'question_id' : 'story_id'
}

export async function isFollowing(userId: string, target: FollowTarget) {
  const admin = createAdminClient()
  const { data } = await admin.from('follows')
    .select('user_id').eq('user_id', userId).eq(column(target), target.id).maybeSingle()
  return !!data
}

/** Idempotent: following something twice is not an error. */
export async function follow(userId: string, communityId: string, target: FollowTarget) {
  const admin = createAdminClient()
  const { error } = await admin.from('follows')
    .insert({ user_id: userId, community_id: communityId, [column(target)]: target.id })
  if (error && error.code !== '23505') return { error: error.message }
  return {}
}

export async function unfollow(userId: string, target: FollowTarget) {
  const admin = createAdminClient()
  const { error } = await admin.from('follows')
    .delete().eq('user_id', userId).eq(column(target), target.id)
  return error ? { error: error.message } : {}
}

/**
 * Bell everyone following `target`, except the people in `skip` (the actor, and
 * anyone already told by a more specific notification). Only active members are
 * notified: someone who left can't open a members-only page.
 *
 * `actorId` null means "don't name who did it" (an anonymous story's author).
 */
export async function notifyFollowers(opts: {
  target: FollowTarget
  communityId: string
  type: 'follow_answer' | 'follow_story_reply'
  actorId: string | null
  skip: string[]
}) {
  const admin = createAdminClient()
  const { data: rows } = await admin.from('follows')
    .select('user_id').eq(column(opts.target), opts.target.id)
  const skip = new Set(opts.skip)
  const ids = (rows ?? []).map(r => r.user_id as string).filter(id => !skip.has(id))
  if (ids.length === 0) return

  const { data: members } = await admin.from('community_members')
    .select('user_id').eq('community_id', opts.communityId).eq('status', 'active').in('user_id', ids)
  const { data: community } = await admin.from('communities')
    .select('owner_id').eq('id', opts.communityId).single()
  const allowed = new Set((members ?? []).map(m => m.user_id as string))
  if (community?.owner_id) allowed.add(community.owner_id)

  const recipients = ids.filter(id => allowed.has(id))
  if (recipients.length === 0) return

  // ⚠️ Must be awaited: an un-awaited Supabase query builder never runs.
  await admin.from('notifications').insert(recipients.map(user_id => ({
    user_id,
    type: opts.type,
    actor_id: opts.actorId,
    community_id: opts.communityId,
    message_id: opts.target.id,
  })))
}
