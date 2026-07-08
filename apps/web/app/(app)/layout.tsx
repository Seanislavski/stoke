import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppNav from '@/components/AppNav'
import TimezoneDetector from '@/components/TimezoneDetector'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: profile }, { data: platformRoleRow }, { count: staffCount }] = await Promise.all([
    supabase.from('profiles').select('username, display_name, avatar_url, timezone_detected').eq('id', user.id).single(),
    supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle(),
    admin
      .from('community_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('role', ['organizer', 'moderator'])
      .eq('status', 'active'),
  ])

  // Organizer guide is for community staff (organizers/moderators/owners) and platform staff
  const isCommunityStaff = (staffCount ?? 0) > 0 || !!platformRoleRow

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <AppNav profile={profile} platformRole={platformRoleRow?.role ?? null} userId={user.id} isCommunityStaff={isCommunityStaff} />
      <TimezoneDetector alreadyDetected={profile?.timezone_detected ?? true} />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
