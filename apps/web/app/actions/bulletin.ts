'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'

async function getUserMembership(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, membership: null }

  const { data: membership } = await supabase
    .from('community_members')
    .select('role, status')
    .eq('community_id', communityId)
    .eq('user_id', user.id)
    .maybeSingle()

  return { user, membership }
}

export async function submitPost(communityId: string, slug: string, formData: FormData) {
  const { user, membership } = await getUserMembership(communityId)
  if (!user || membership?.status !== 'active') return { error: 'Not a member of this community.' }

  const title = (formData.get('title') as string).trim()
  const content = (formData.get('content') as string ?? '').trim()
  const photosRaw = formData.get('photos') as string | null
  const photos: string[] = photosRaw ? JSON.parse(photosRaw) : []
  if (!title) return { error: 'Title is required.' }
  if (!content && !photos.length) return { error: 'Add some content or at least one photo.' }

  const isMod = membership.role === 'organizer' || membership.role === 'moderator'
  const status = isMod ? 'published' : 'pending'
  const published_at = isMod ? new Date().toISOString() : null

  const supabase = await createClient()
  const { error } = await supabase
    .from('bulletin_posts')
    .insert({ community_id: communityId, author_id: user.id, title, content, photos, status, published_at })

  if (error) return { error: 'Could not submit post.' }

  revalidatePath(`/communities/${slug}`)
  return { ok: true, status }
}

export async function approvePost(postId: string, communityId: string, slug: string) {
  const { user, membership } = await getUserMembership(communityId)
  if (!user) return { error: 'Not authorized.' }

  const admin = createAdminClient()
  const [{ data: community }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isOwner = community?.owner_id === user.id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isPlatformStaff = !!platformRole
  if (!isMod && !isOwner && !isPlatformStaff) return { error: 'Not authorized.' }

  const { error } = await admin
    .from('bulletin_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) return { error: 'Could not approve post.' }

  logAction({ actorId: user.id, communityId, action: 'post.approved', targetId: postId, targetType: 'post' })
  revalidatePath(`/communities/${slug}`)
  return { ok: true }
}

export async function rejectPost(postId: string, communityId: string, slug: string) {
  const { user, membership } = await getUserMembership(communityId)
  if (!user) return { error: 'Not authorized.' }

  const admin = createAdminClient()
  const [{ data: community }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isOwner = community?.owner_id === user.id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isPlatformStaff = !!platformRole
  if (!isMod && !isOwner && !isPlatformStaff) return { error: 'Not authorized.' }

  const { error } = await admin
    .from('bulletin_posts')
    .update({ status: 'rejected' })
    .eq('id', postId)

  if (error) return { error: 'Could not reject post.' }

  logAction({ actorId: user.id, communityId, action: 'post.rejected', targetId: postId, targetType: 'post' })
  revalidatePath(`/communities/${slug}`)
  return { ok: true }
}

export async function deletePost(postId: string, communityId: string, slug: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized.' }

  const admin = createAdminClient()
  const [{ data: post }, { data: community }, { data: membership }, { data: platformRole }] = await Promise.all([
    admin.from('bulletin_posts').select('submitted_by').eq('id', postId).single(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('community_members').select('role').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])

  if (!post) return { error: 'Post not found.' }

  const isAuthor = post.submitted_by === user.id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isOwner = community?.owner_id === user.id
  const isPlatformStaff = !!platformRole

  if (!isAuthor && !isMod && !isOwner && !isPlatformStaff) return { error: 'Not authorized.' }

  await admin.from('bulletin_posts').delete().eq('id', postId)
  logAction({ actorId: user.id, communityId, action: 'post.deleted', targetId: postId, targetType: 'post', metadata: { self: isAuthor } })
  revalidatePath(`/communities/${slug}`)
  return {}
}
