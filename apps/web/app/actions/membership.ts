'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendEmail, joinRequestHtml } from '@/lib/email'
import { logAction } from '@/lib/audit'

export async function joinCommunity(communityId: string, joinMode: string, slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const status = joinMode === 'open' ? 'active' : 'pending'

  const { error } = await supabase
    .from('community_members')
    .insert({ community_id: communityId, user_id: user.id, role: 'member', status })

  if (error) return { error: 'Could not join community.' }

  logAction({ actorId: user.id, communityId, action: status === 'active' ? 'member.joined' : 'member.requested', targetUserId: user.id })

  if (status === 'pending') {
    void notifyModsOfJoinRequest(communityId, slug, user.id)
  }

  revalidatePath(`/communities/${slug}`)
  return { status }
}

async function notifyModsOfJoinRequest(communityId: string, slug: string, applicantId: string) {
  const admin = createAdminClient()
  const [{ data: community }, { data: mods }, { data: applicantAuth }, { data: applicantProfile }] = await Promise.all([
    admin.from('communities').select('name').eq('id', communityId).single(),
    admin.from('community_members').select('user_id').eq('community_id', communityId).in('role', ['organizer', 'moderator']).eq('status', 'active'),
    admin.auth.admin.getUserById(applicantId),
    admin.from('profiles').select('username, display_name').eq('id', applicantId).single(),
  ])
  if (!community || !mods || !applicantProfile) return

  const html = joinRequestHtml(community.name, slug, applicantProfile.username, applicantProfile.display_name)
  await Promise.all(
    mods.map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id)
      const email = data.user?.email
      if (email) await sendEmail(email, `New join request for ${community.name}`, html)
    })
  )
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
