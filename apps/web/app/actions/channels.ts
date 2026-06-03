'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { checkChannelLimit } from '@/lib/billing'

export async function createChannel(communityId: string, slug: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  if (!name) return { error: 'Name is required' }

  try {
    await checkChannelLimit(communityId)
  } catch (e) {
    return { error: (e as Error).message }
  }

  const { error } = await supabase
    .from('channels')
    .insert({ community_id: communityId, name, description, created_by: user.id })

  if (error) return { error: error.message }
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}

export async function deleteChannel(channelId: string, slug: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('channels').delete().eq('id', channelId)
  if (error) return { error: error.message }
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)
  return { success: true }
}
