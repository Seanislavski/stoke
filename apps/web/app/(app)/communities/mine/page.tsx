import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  organizer: 'Organizer',
  moderator: 'Moderator',
  member: 'Member',
}

export default async function MyCommunitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('community_members')
    .select('role, status, joined_at, communities(id, name, slug, description, image_url, join_mode)')
    .eq('user_id', user!.id)
    .in('status', ['active', 'pending'])
    .order('joined_at', { ascending: false })

  const active  = (memberships ?? []).filter(m => m.status === 'active')
  const pending = (memberships ?? []).filter(m => m.status === 'pending')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">My communities</h1>
        <div className="flex gap-3">
          <Link href="/communities" className="text-sm text-stone-500 hover:text-stone-700">Browse all</Link>
          <Link href="/communities/new" className="text-sm text-orange-600 hover:underline font-medium">+ Create</Link>
        </div>
      </div>

      {active.length === 0 && pending.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
          <p className="text-stone-500 mb-4">You haven't joined any communities yet.</p>
          <Link
            href="/communities"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Browse communities
          </Link>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          {active.map(m => {
            const community = Array.isArray(m.communities) ? m.communities[0] : m.communities
            if (!community) return null
            return (
              <Link
                key={community.id}
                href={`/communities/${community.slug}`}
                className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 p-4 hover:border-orange-300 hover:shadow-sm transition-all"
              >
                {community.image_url && (
                  <img
                    src={community.image_url}
                    alt={community.name}
                    className="w-12 h-12 rounded-lg object-cover shrink-0 border border-stone-100"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="font-medium text-stone-900">{community.name}</h2>
                  {community.description && (
                    <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">{community.description}</p>
                  )}
                </div>
                <span className="text-xs text-stone-400 shrink-0">{ROLE_LABELS[m.role] ?? m.role}</span>
              </Link>
            )
          })}
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Pending approval ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(m => {
              const community = Array.isArray(m.communities) ? m.communities[0] : m.communities
              if (!community) return null
              return (
                <div
                  key={community.id}
                  className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 p-4 opacity-70"
                >
                  {community.image_url && (
                    <img
                      src={community.image_url}
                      alt={community.name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0 border border-stone-100"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium text-stone-900">{community.name}</h2>
                    {community.description && (
                      <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">{community.description}</p>
                    )}
                  </div>
                  <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full shrink-0">
                    Pending
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
