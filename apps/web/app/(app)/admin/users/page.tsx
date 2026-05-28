import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import BanButton from '@/components/admin/BanButton'
import RoleSelect from '@/components/admin/RoleSelect'
import Link from 'next/link'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: viewerRole } = await supabase.from('platform_roles').select('role').eq('user_id', user!.id).maybeSingle()
  const isOwner = viewerRole?.role === 'owner'

  const admin = createAdminClient()

  let query = admin
    .from('profiles')
    .select('id, username, display_name, avatar_url, is_banned, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q) {
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
  }

  const { data: users } = await query

  const userIds = users?.map(u => u.id) ?? []
  const { data: platformRoles } = userIds.length
    ? await admin.from('platform_roles').select('user_id, role').in('user_id', userIds)
    : { data: [] }

  const roleMap = Object.fromEntries((platformRoles ?? []).map(r => [r.user_id, r.role]))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-stone-900">Users</h1>
        <span className="text-sm text-stone-400">{users?.length ?? 0} shown</span>
      </div>

      <form method="GET" action="/admin/users" className="mb-6">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by username or display name..."
            className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {users?.map(u => (
          <div key={u.id} className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 p-3">
            <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-sm font-semibold text-stone-500 shrink-0 overflow-hidden">
              {u.avatar_url
                ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                : ((u.display_name ?? u.username) || '?')[0].toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/profile/${u.username}`} className="text-sm font-medium text-stone-900 hover:underline">
                  {u.display_name ?? u.username}
                </Link>
                <span className="text-xs text-stone-400">@{u.username}</span>
                {u.is_banned && (
                  <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">banned</span>
                )}
                {roleMap[u.id] && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">
                    {roleMap[u.id].replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">
                Joined {new Date(u.created_at).toLocaleDateString('en-US')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isOwner && roleMap[u.id] !== 'owner' && (
                <RoleSelect userId={u.id} currentRole={roleMap[u.id] ?? null} />
              )}
              {u.id !== user!.id && roleMap[u.id] !== 'owner' && (
                <BanButton userId={u.id} isBanned={u.is_banned ?? false} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
