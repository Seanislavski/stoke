import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppNav from '@/components/AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: platformRoleRow }] = await Promise.all([
    supabase.from('profiles').select('username, display_name, avatar_url').eq('id', user.id).single(),
    supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ])

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <AppNav profile={profile} platformRole={platformRoleRow?.role ?? null} userId={user.id} />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
