'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { checkChannelLimit } from '@/lib/billing'
import { logAction } from '@/lib/audit'

async function requireOrgOrMod(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Not authenticated' as const }

  const admin = createAdminClient()
  const [{ data: membership }, { data: community }] = await Promise.all([
    admin.from('community_members').select('role').eq('community_id', communityId).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
  ])

  const isOwner = community?.owner_id === user.id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  if (!isOwner && !isMod) return { user: null, error: 'Not authorized' as const }
  return { user, error: null }
}

export async function createChannel(communityId: string, slug: string, formData: FormData) {
  const { user, error: authError } = await requireOrgOrMod(communityId)
  if (!user) return { error: authError }

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  if (!name) return { error: 'Name is required' }

  try {
    await checkChannelLimit(communityId)
  } catch (e) {
    return { error: (e as Error).message }
  }

  const supabase = await createClient()
  const { data: channel, error } = await supabase
    .from('channels')
    .insert({ community_id: communityId, name, description, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: 'channel.created', targetId: channel.id, targetType: 'channel', metadata: { name } })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function deleteChannel(channelId: string, slug: string) {
  const admin = createAdminClient()
  const { data: channel } = await admin.from('channels').select('community_id, name').eq('id', channelId).single()
  if (!channel) return { error: 'Channel not found' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error: authError } = await requireOrgOrMod(channel.community_id)
  if (authError) return { error: authError }

  const { error } = await admin.from('channels').delete().eq('id', channelId)
  if (error) return { error: error.message }
  if (user) logAction({ actorId: user.id, communityId: channel.community_id, action: 'channel.deleted', targetId: channelId, targetType: 'channel', metadata: { name: channel.name } })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}
