import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: roleRow } = await supabase.from('platform_roles').select('role').eq('user_id', user!.id).maybeSingle()
  if (roleRow?.role !== 'owner') redirect('/home')

  const admin = createAdminClient()
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: totalCommunities },
    { count: newUsersWeek },
    { count: newCommunitiesWeek },
    { data: recentUsers },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('communities').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo),
    admin.from('communities').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo),
    admin.from('profiles').select('id, username, display_name, avatar_url, created_at').order('created_at', { ascending: false }).limit(8),
  ])

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900 mb-6">Platform Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total users', value: totalUsers ?? 0 },
          { label: 'Total communities', value: totalCommunities ?? 0 },
          { label: 'New users (7d)', value: newUsersWeek ?? 0 },
          { label: 'New communities (7d)', value: newCommunitiesWeek ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-stone-200 p-4">
            <p className="text-2xl font-semibold text-stone-900">{value}</p>
            <p className="text-xs text-stone-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-stone-200">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-700">Recent signups</h2>
          <Link href="/admin/users" className="text-xs text-orange-600 hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-stone-100">
          {recentUsers?.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-xs font-semibold text-stone-500 shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  : ((u.display_name ?? u.username) || '?')[0].toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${u.username}`} className="text-sm text-stone-800 hover:underline">
                  {u.display_name ?? u.username}
                </Link>
                <span className="text-xs text-stone-400 ml-2">@{u.username}</span>
              </div>
              <span className="text-xs text-stone-400 shrink-0">
                {new Date(u.created_at).toLocaleDateString('en-US')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
