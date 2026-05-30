import { createAdminClient } from '@/lib/supabase/admin'
import BanButton from '@/components/admin/BanButton'
import Link from 'next/link'

export default async function AdminModerationPage() {
  const admin = createAdminClient()

  const { data: bannedUsers } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url, created_at')
    .eq('is_banned', true)
    .order('updated_at', { ascending: false })

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-stone-900 mb-1">Moderation</h1>
        <p className="text-sm text-stone-500">Platform bans.</p>
      </div>

      {/* Platform bans */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-3">
          Platform bans {bannedUsers?.length ? `(${bannedUsers.length})` : ''}
        </h2>
        {!bannedUsers?.length ? (
          <div className="bg-white rounded-xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
            No platform bans
          </div>
        ) : (
          <div className="space-y-2">
            {bannedUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 p-3">
                <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-sm font-semibold text-stone-500 shrink-0 overflow-hidden">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    : ((u.display_name ?? u.username) || '?')[0].toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${u.username}`} className="text-sm font-medium text-stone-900 hover:underline">
                      {u.display_name ?? u.username}
                    </Link>
                    <span className="text-xs text-stone-400">@{u.username}</span>
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">banned</span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Joined {new Date(u.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
                <BanButton userId={u.id} isBanned={true} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
