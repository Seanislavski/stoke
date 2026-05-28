import { createAdminClient } from '@/lib/supabase/admin'
import { ACTION_LABELS } from '@/lib/audit'
import Link from 'next/link'

export default async function AdminAuditLogPage() {
  const admin = createAdminClient()

  const { data: entries } = await admin
    .from('audit_log')
    .select('id, created_at, action, community_id, target_user_id, target_id, target_type, metadata, actor:actor_id(username, display_name), target_user:target_user_id(username, display_name), community:community_id(name, slug)')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900 mb-6">Audit Log</h1>

      {!entries || entries.length === 0 ? (
        <p className="text-sm text-stone-400">No actions logged yet.</p>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-stone-100">
            {entries.map((entry) => {
              const actor = Array.isArray(entry.actor) ? entry.actor[0] : entry.actor
              const targetUser = Array.isArray(entry.target_user) ? entry.target_user[0] : entry.target_user
              const community = Array.isArray(entry.community) ? entry.community[0] : entry.community
              const label = ACTION_LABELS[entry.action] ?? entry.action
              const meta = entry.metadata as Record<string, unknown> | null
              const isPlatform = !entry.community_id
              const communitySlug = community?.slug

              const targetLink = (() => {
                const type = entry.target_type
                if (type === 'post' && communitySlug) return `/communities/${communitySlug}?tab=bulletin`
                if (type === 'resource' && communitySlug) return `/communities/${communitySlug}?tab=resources`
                if (type === 'event' && communitySlug) return `/communities/${communitySlug}?tab=events`
                if (type === 'message' && communitySlug && typeof meta?.channel_id === 'string') return `/communities/${communitySlug}/channels/${meta.channel_id}?message=${entry.target_id}`
                if (targetUser?.username) return `/profile/${targetUser.username}`
                return null
              })()

              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <span className="text-stone-400 text-xs shrink-0 mt-0.5 w-36">
                    {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-stone-800">
                      {actor?.display_name ?? actor?.username ?? 'Unknown'}
                    </span>
                    <span className="text-stone-500"> — {label}</span>
                    {targetUser && (
                      <span className="text-stone-400"> · {targetUser.display_name ?? targetUser.username}</span>
                    )}
                    {entry.action === 'member.role_changed' && meta && (
                      <span className="text-stone-400"> · {String(meta.from_role)} → {String(meta.to_role)}</span>
                    )}
                    {(entry.action === 'platform.role.assigned' || entry.action === 'platform.role.removed') && typeof meta?.role === 'string' && (
                      <span className="text-stone-400"> · {meta.role}</span>
                    )}
                    {community && (
                      <span className="ml-2 text-xs text-stone-300">in {community.name}</span>
                    )}
                    {targetLink && (
                      <Link href={targetLink} className="ml-2 text-xs text-orange-500 hover:text-orange-700 hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                  {isPlatform && (
                    <span className="text-xs text-orange-500 font-medium shrink-0">platform</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
