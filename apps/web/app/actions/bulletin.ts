'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

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
  const content = (formData.get('content') as string).trim()
  if (!title || !content) return { error: 'Title and content are required.' }

  const isMod = membership.role === 'organizer' || membership.role === 'moderator'
  const status = isMod ? 'published' : 'pending'
  const published_at = isMod ? new Date().toISOString() : null

  const supabase = await createClient()
  const { error } = await supabase
    .from('bulletin_posts')
    .insert({ community_id: communityId, author_id: user.id, title, content, status, published_at })

  if (error) return { error: 'Could not submit post.' }

  revalidatePath(`/communities/${slug}`)
  return { ok: true, status }
}

export async function approvePost(postId: string, communityId: string, slug: string) {
  const { membership } = await getUserMembership(communityId)
  if (!membership || !['organizer', 'moderator'].includes(membership.role)) {
    return { error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('bulletin_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) return { error: 'Could not approve post.' }

  revalidatePath(`/communities/${slug}`)
  return { ok: true }
}

export async function rejectPost(postId: string, communityId: string, slug: string) {
  const { membership } = await getUserMembership(communityId)
  if (!membership || !['organizer', 'moderator'].includes(membership.role)) {
    return { error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('bulletin_posts')
    .update({ status: 'rejected' })
    .eq('id', postId)

  if (error) return { error: 'Could not reject post.' }

  revalidatePath(`/communities/${slug}`)
  return { ok: true }
}
