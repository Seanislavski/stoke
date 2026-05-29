'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'

async function requireModOrThrow(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const [{ data: community }, { data: membership }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])

  const isOwner = community?.owner_id === user.id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'
  const isPlatformStaff = !!platformRole

  if (!isOwner && !isMod && !isPlatformStaff) throw new Error('Forbidden')

  return user
}

export async function createInvite(communityId: string, slug: string, maxUses: number | null, expiresIn: string | null) {
  const user = await requireModOrThrow(communityId)

  let expiresAt: string | null = null
  if (expiresIn) {
    const days = expiresIn === '1d' ? 1 : expiresIn === '7d' ? 7 : 30
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  }

  const admin = createAdminClient()
  const { data, error } = await admin.from('invites').insert({
    community_id: communityId,
    created_by: user.id,
    max_uses: maxUses,
    expires_at: expiresAt,
  }).select('token').single()

  if (error || !data) return { error: error?.message ?? 'Failed to create invite' }
  logAction({ actorId: user.id, communityId, action: 'invite.created', targetId: data.token, targetType: 'invite', metadata: { max_uses: maxUses, expires_in: expiresIn } })
  revalidatePath(`/communities/${slug}/settings`)
  return { token: data.token }
}

export async function revokeInvite(inviteId: string, slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { data: invite } = await admin.from('invites').select('community_id, token').eq('id', inviteId).single()
  await admin.from('invites').delete().eq('id', inviteId)
  if (invite) logAction({ actorId: user.id, communityId: invite.community_id, action: 'invite.revoked', targetId: invite.token, targetType: 'invite' })
  revalidatePath(`/communities/${slug}/settings`)
}

export async function useInvite(token: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to use this invite' }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('invites')
    .select('id, community_id, max_uses, use_count, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return { error: 'This invite link is invalid or has been revoked' }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: 'This invite link has expired' }
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) return { error: 'This invite link has reached its maximum uses' }

  const { data: community } = await admin.from('communities').select('slug, join_mode').eq('id', invite.community_id).single()
  if (!community) return { error: 'Community not found' }

  // Check existing membership
  const { data: existing } = await admin
    .from('community_members')
    .select('status')
    .eq('community_id', invite.community_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.status === 'active') return { slug: community.slug, alreadyMember: true }
  if (existing?.status === 'banned') return { error: 'You have been banned from this community' }

  // Join directly if open, otherwise add to pending queue
  const newStatus = community.join_mode === 'open' ? 'active' : 'pending'

  if (existing) {
    await admin.from('community_members').update({ status: newStatus }).eq('community_id', invite.community_id).eq('user_id', user.id)
  } else {
    await admin.from('community_members').insert({ community_id: invite.community_id, user_id: user.id, status: newStatus })
  }

  await admin.from('invites').update({ use_count: invite.use_count + 1 }).eq('id', invite.id)

  return { slug: community.slug, status: newStatus }
}
