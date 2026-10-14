'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { follow, unfollow, type FollowTarget } from '@/lib/follows'

/** Follow or unfollow a question or story. Returns whether the caller now follows it. */
export async function setFollow(
  kind: FollowTarget['kind'],
  targetId: string,
  communityId: string,
  on: boolean,
): Promise<{ error?: string; on?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' }

  const target: FollowTarget = { kind, id: targetId }
  if (!on) {
    const res = await unfollow(user.id, target)
    return res.error ? res : { on: false }
  }

  // Following needs the thing to exist in this community, and the caller to belong there.
  const admin = createAdminClient()
  const table = kind === 'question' ? 'kb_questions' : 'stories'
  const [{ data: row }, { data: membership }, { data: community }, { data: platformRole }] = await Promise.all([
    admin.from(table).select('id').eq('id', targetId).eq('community_id', communityId).maybeSingle(),
    admin.from('community_members').select('status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  if (!row) return { error: 'Not found' }
  const canFollow = membership?.status === 'active' || user.id === community?.owner_id || !!platformRole
  if (!canFollow) return { error: 'Only members can follow this' }

  const res = await follow(user.id, communityId, target)
  return res.error ? res : { on: true }
}
