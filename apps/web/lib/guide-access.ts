import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The staff gate shared by the organizer guides and their assets: community
 * organizers/moderators (in any community) and platform staff.
 *
 * Kept in one place so a page and the route handler serving its screenshots can
 * never drift apart — a gated page whose images are ungated is not gated.
 */
export async function getGuideAccess(): Promise<{ userId: string | null; isStaff: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { userId: null, isStaff: false }

  const admin = createAdminClient()
  const [{ count: staffCount }, { data: platformRoleRow }] = await Promise.all([
    admin
      .from('community_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('role', ['organizer', 'moderator'])
      .eq('status', 'active'),
    supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ])

  return { userId: user.id, isStaff: (staffCount ?? 0) > 0 || !!platformRoleRow }
}
