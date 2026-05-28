'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'

async function requirePlatformRole(...allowed: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data } = await supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle()
  if (!data || !allowed.includes(data.role)) throw new Error('Forbidden')
  return user
}

export async function platformBanUser(userId: string, ban: boolean) {
  const caller = await requirePlatformRole('owner', 'platform_moderator')
  const admin = createAdminClient()

  // Prevent banning anyone with a platform role (only owner can ban platform roles)
  const { data: targetRole } = await admin
    .from('platform_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (targetRole) {
    const { data: callerRole } = await admin
      .from('platform_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle()
    if (callerRole?.role !== 'owner') throw new Error('Only the owner can ban platform team members')
  }

  await admin.from('profiles').update({ is_banned: ban }).eq('id', userId)
  logAction({ actorId: caller.id, action: ban ? 'platform.user.banned' : 'platform.user.unbanned', targetUserId: userId })
  revalidatePath('/admin/users')
  revalidatePath('/admin/moderation')
}

export async function assignPlatformRole(userId: string, role: string | null) {
  const caller = await requirePlatformRole('owner')
  const admin = createAdminClient()
  if (role === null) {
    await admin.from('platform_roles').delete().eq('user_id', userId)
    logAction({ actorId: caller.id, action: 'platform.role.removed', targetUserId: userId })
  } else {
    await admin.from('platform_roles').upsert({ user_id: userId, role })
    logAction({ actorId: caller.id, action: 'platform.role.assigned', targetUserId: userId, metadata: { role } })
  }
  revalidatePath('/admin/users')
}

export async function toggleCommunityListed(communityId: string, isListed: boolean) {
  await requirePlatformRole('owner', 'community_manager')
  const admin = createAdminClient()
  await admin.from('communities').update({ is_listed: isListed }).eq('id', communityId)
  revalidatePath('/admin/communities')
}
