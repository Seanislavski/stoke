'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'

type CallerRole = 'owner' | 'organizer' | 'moderator'

async function getCallerRole(communityId: string): Promise<{ userId: string; role: CallerRole } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: community } = await supabase
    .from('communities')
    .select('owner_id')
    .eq('id', communityId)
    .single()

  if (community?.owner_id === user.id) return { userId: user.id, role: 'owner' }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!member || member.role === 'member') return null
  return { userId: user.id, role: member.role as 'organizer' | 'moderator' }
}

export async function updateCommunityInfo(communityId: string, slug: string, formData: FormData) {
  const caller = await getCallerRole(communityId)
  if (!caller) return { error: 'Not authorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('communities')
    .update({
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || null,
      join_mode: formData.get('join_mode') as string,
      is_listed: formData.get('is_listed') === 'on',
      category_id: (formData.get('category_id') as string) || null,
    })
    .eq('id', communityId)

  if (error) return { error: error.message }

  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function updateMemberRole(communityId: string, slug: string, userId: string, role: string) {
  const caller = await getCallerRole(communityId)
  if (!caller || !['owner', 'organizer'].includes(caller.role)) return { error: 'Not authorized' }
  if (caller.userId === userId) return { error: 'Cannot change your own role' }

  const admin = createAdminClient()
  const { data: prev } = await admin.from('community_members').select('role').eq('community_id', communityId).eq('user_id', userId).single()
  const { error } = await admin
    .from('community_members')
    .update({ role })
    .eq('community_id', communityId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  logAction({ actorId: caller.userId, communityId, action: 'member.role_changed', targetUserId: userId, metadata: { from_role: prev?.role, to_role: role } })
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function removeMember(communityId: string, slug: string, userId: string) {
  const caller = await getCallerRole(communityId)
  if (!caller) return { error: 'Not authorized' }
  if (caller.userId === userId) return { error: 'Cannot remove yourself' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  logAction({ actorId: caller.userId, communityId, action: 'member.removed', targetUserId: userId })
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function banMember(communityId: string, slug: string, userId: string) {
  const caller = await getCallerRole(communityId)
  if (!caller) return { error: 'Not authorized' }
  if (caller.userId === userId) return { error: 'Cannot ban yourself' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('community_members')
    .update({ status: 'banned' })
    .eq('community_id', communityId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  logAction({ actorId: caller.userId, communityId, action: 'member.banned', targetUserId: userId })
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function unbanMember(communityId: string, slug: string, userId: string) {
  const caller = await getCallerRole(communityId)
  if (!caller) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('community_members')
    .update({ status: 'active', role: 'member' })
    .eq('community_id', communityId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  logAction({ actorId: caller.userId, communityId, action: 'member.unbanned', targetUserId: userId })
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function approveRequest(communityId: string, slug: string, userId: string) {
  const caller = await getCallerRole(communityId)
  if (!caller) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('community_members')
    .update({ status: 'active' })
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  logAction({ actorId: caller.userId, communityId, action: 'member.approved', targetUserId: userId })
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function rejectRequest(communityId: string, slug: string, userId: string) {
  const caller = await getCallerRole(communityId)
  if (!caller) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) return { error: error.message }
  logAction({ actorId: caller.userId, communityId, action: 'member.rejected', targetUserId: userId })
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}
