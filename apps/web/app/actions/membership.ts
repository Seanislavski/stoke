'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function joinCommunity(communityId: string, joinMode: string, slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const status = joinMode === 'open' ? 'active' : 'pending'

  const { error } = await supabase
    .from('community_members')
    .insert({ community_id: communityId, user_id: user.id, role: 'member', status })

  if (error) return { error: 'Could not join community.' }

  revalidatePath(`/communities/${slug}`)
  return { status }
}

export async function leaveCommunity(communityId: string, slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', user.id)

  if (error) return { error: 'Could not leave community.' }

  revalidatePath(`/communities/${slug}`)
  return { ok: true }
}
