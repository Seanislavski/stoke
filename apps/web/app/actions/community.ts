'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'
import { sendEmail, joinApprovedHtml, joinRejectedHtml, ownershipTransferredHtml } from '@/lib/email'
import { checkMemberLimit, checkCommunityLimit } from '@/lib/billing'

type CallerRole = 'owner' | 'organizer' | 'moderator'

async function isPlatformProtected(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('platform_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['owner', 'platform_moderator'])
    .maybeSingle()
  return !!data
}

async function isTargetOrganizer(communityId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .maybeSingle()
  return data?.role === 'organizer'
}

async function getCallerRole(communityId: string): Promise<{ userId: string; role: CallerRole } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: community }, { data: platformRole }, { data: member }] = await Promise.all([
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
    admin.from('community_members').select('role').eq('community_id', communityId).eq('user_id', user.id).eq('status', 'active').single(),
  ])

  if (community?.owner_id === user.id) return { userId: user.id, role: 'owner' }
  if (platformRole) return { userId: user.id, role: 'organizer' }
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
      about: (formData.get('about') as string) || null,
      join_mode: formData.get('join_mode') as string,
      is_listed: formData.get('is_listed') === 'on',
      category_id: (formData.get('category_id') as string) || null,
    })
    .eq('id', communityId)

  if (error) return { error: error.message }

  logAction({
    actorId: caller.userId,
    communityId,
    action: 'community.settings_updated',
    metadata: {
      name: formData.get('name'),
      join_mode: formData.get('join_mode'),
      is_listed: formData.get('is_listed') === 'on',
      category_id: formData.get('category_id') || null,
    },
  })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function updateMemberRole(communityId: string, slug: string, userId: string, role: string) {
  const caller = await getCallerRole(communityId)
  if (!caller || !['owner', 'organizer'].includes(caller.role)) return { error: 'Not authorized' }
  if (caller.userId === userId) return { error: 'Cannot change your own role' }
  if (!['member', 'moderator', 'organizer'].includes(role)) return { error: 'Invalid role' }
  if (await isPlatformProtected(userId)) return { error: 'Cannot modify platform staff' }

  const admin = createAdminClient()
  const { data: prev } = await admin.from('community_members').select('role').eq('community_id', communityId).eq('user_id', userId).single()

  // Only the community owner (or platform staff) may grant or change the Organizer role.
  // Organizers can delegate moderation (assign Moderator) but cannot create or alter co-owners.
  if (caller.role !== 'owner' && (role === 'organizer' || prev?.role === 'organizer')) {
    return { error: 'Only the community owner can assign or change the Organizer role.' }
  }

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
  if (await isPlatformProtected(userId)) return { error: 'Cannot remove platform staff' }
  if (caller.role !== 'owner' && await isTargetOrganizer(communityId, userId)) {
    return { error: 'Only the community owner can remove an organizer.' }
  }

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
  if (await isPlatformProtected(userId)) return { error: 'Cannot ban platform staff' }
  if (caller.role !== 'owner' && await isTargetOrganizer(communityId, userId)) {
    return { error: 'Only the community owner can ban an organizer.' }
  }

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

export async function transferOwnership(communityId: string, slug: string, newOwnerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: community } = await admin
    .from('communities')
    .select('owner_id, name')
    .eq('id', communityId)
    .single()
  if (!community) return { error: 'Community not found' }

  // Only the actual community owner (or platform staff) may transfer ownership.
  const isOwner = community.owner_id === user.id
  const platformStaff = await isPlatformProtected(user.id)
  if (!isOwner && !platformStaff) return { error: 'Only the community owner can transfer ownership.' }

  if (newOwnerId === community.owner_id) return { error: 'That person is already the owner.' }

  // The recipient must be an active organizer — a deliberately pre-vetted co-owner.
  const { data: target } = await admin
    .from('community_members')
    .select('role, status')
    .eq('community_id', communityId)
    .eq('user_id', newOwnerId)
    .maybeSingle()
  if (!target || target.status !== 'active' || target.role !== 'organizer') {
    return { error: 'You can only transfer ownership to an active organizer. Promote them to Organizer first.' }
  }

  // Billing guardrail: the new owner must have room under their plan's community cap.
  try {
    await checkCommunityLimit(newOwnerId)
  } catch (e) {
    return { error: `Can't transfer — the new owner is at their plan limit. ${(e as Error).message}` }
  }

  const prevOwnerId = community.owner_id

  const { error } = await admin
    .from('communities')
    .update({ owner_id: newOwnerId })
    .eq('id', communityId)
  if (error) return { error: error.message }

  // Keep the previous owner as an active organizer — they retain access, lose owner-only powers.
  await admin
    .from('community_members')
    .update({ role: 'organizer', status: 'active' })
    .eq('community_id', communityId)
    .eq('user_id', prevOwnerId)

  // Resolve names once for the audit metadata + the notification email.
  const { data: nameRows } = await admin
    .from('profiles')
    .select('id, username, display_name')
    .in('id', [prevOwnerId, newOwnerId])
  const nameOf = (id: string) => {
    const p = nameRows?.find(r => r.id === id)
    return p?.display_name ?? p?.username ?? null
  }
  const prevName = nameOf(prevOwnerId)

  logAction({
    actorId: user.id,
    communityId,
    action: 'community.ownership_transferred',
    targetUserId: newOwnerId,
    metadata: {
      from_owner: prevOwnerId,
      to_owner: newOwnerId,
      from_owner_name: prevName,
      to_owner_name: nameOf(newOwnerId),
    },
  })

  // Notify the new owner (fire-and-forget).
  void (async () => {
    const { data: newUser } = await admin.auth.admin.getUserById(newOwnerId)
    const email = newUser.user?.email
    if (email) await sendEmail(email, `You're now the owner of ${community.name}`, ownershipTransferredHtml(community.name, slug, prevName ?? 'The previous owner'))
  })()

  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function approveRequest(communityId: string, slug: string, userId: string) {
  const caller = await getCallerRole(communityId)
  if (!caller) return { error: 'Not authorized' }

  try {
    await checkMemberLimit(communityId)
  } catch (e) {
    return { error: (e as Error).message }
  }

  const admin = createAdminClient()
  const [{ error }, { data: community }] = await Promise.all([
    admin.from('community_members').update({ status: 'active' }).eq('community_id', communityId).eq('user_id', userId).eq('status', 'pending'),
    admin.from('communities').select('name').eq('id', communityId).single(),
  ])

  if (error) return { error: error.message }
  logAction({ actorId: caller.userId, communityId, action: 'member.approved', targetUserId: userId })

  if (community) {
    void (async () => {
      const { data } = await admin.auth.admin.getUserById(userId)
      const email = data.user?.email
      if (email) await sendEmail(email, `You've been approved to join ${community.name}`, joinApprovedHtml(community.name, slug))
    })()
  }

  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function rejectRequest(communityId: string, slug: string, userId: string) {
  const caller = await getCallerRole(communityId)
  if (!caller) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const [{ error }, { data: community }] = await Promise.all([
    admin.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId).eq('status', 'pending'),
    admin.from('communities').select('name').eq('id', communityId).single(),
  ])

  if (error) return { error: error.message }
  logAction({ actorId: caller.userId, communityId, action: 'member.rejected', targetUserId: userId })

  if (community) {
    void (async () => {
      const { data } = await admin.auth.admin.getUserById(userId)
      const email = data.user?.email
      if (email) await sendEmail(email, `Update on your request to join ${community.name}`, joinRejectedHtml(community.name))
    })()
  }

  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}
