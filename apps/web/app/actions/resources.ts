'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'

async function getMembershipOrThrow(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, membership: null }

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('community_members')
    .select('role, status')
    .eq('community_id', communityId)
    .eq('user_id', user.id)
    .maybeSingle()

  return { user, membership }
}

export async function submitResource(communityId: string, slug: string, formData: FormData) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const supabase = await createClient()
  const { data: { user: owner } } = await supabase.auth.getUser()
  const admin = createAdminClient()
  const { data: community } = await admin.from('communities').select('owner_id').eq('id', communityId).single()
  const isOwner = owner?.id === community?.owner_id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isActiveMember = membership?.status === 'active'

  if (!isActiveMember && !isOwner) return { error: 'Must be an active member to submit resources' }

  const autoPublish = isMod || isOwner
  const { error } = await admin.from('resources').insert({
    community_id: communityId,
    submitted_by: user.id,
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    url: formData.get('url') as string,
    resource_type: formData.get('resource_type') as string,
    status: autoPublish ? 'published' : 'pending',
    published_at: autoPublish ? new Date().toISOString() : null,
  })

  if (error) return { error: error.message }
  revalidatePath(`/communities/${slug}`)
  return { status: autoPublish ? 'published' : 'pending' }
}

async function requireModAccess(communityId: string, userId: string, membership: { role: string; status: string } | null) {
  const admin = createAdminClient()
  const [{ data: community }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', userId).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isOwner = userId === community?.owner_id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isPlatformStaff = !!platformRole
  return { allowed: isMod || isOwner || isPlatformStaff }
}

export async function approveResource(resourceId: string, communityId: string, slug: string) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  await admin.from('resources').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', resourceId)
  logAction({ actorId: user.id, communityId, action: 'resource.approved', targetId: resourceId, targetType: 'resource' })
  revalidatePath(`/communities/${slug}`)
  return {}
}

export async function rejectResource(resourceId: string, communityId: string, slug: string) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  await admin.from('resources').update({ status: 'rejected' }).eq('id', resourceId)
  logAction({ actorId: user.id, communityId, action: 'resource.rejected', targetId: resourceId, targetType: 'resource' })
  revalidatePath(`/communities/${slug}`)
  return {}
}

export async function deleteResource(resourceId: string, communityId: string, slug: string): Promise<{ error?: string }> {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  await admin.from('resources').delete().eq('id', resourceId)
  logAction({ actorId: user.id, communityId, action: 'resource.deleted', targetId: resourceId, targetType: 'resource' })
  revalidatePath(`/communities/${slug}`)
  return {}
}
