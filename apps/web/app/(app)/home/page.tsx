import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: memberships } = await supabase
    .from('community_members')
    .select('community_id, role, joined_at, communities(id, name, slug, description)')
    .eq('user_id', user!.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })

  const hasCommunities = memberships && memberships.length > 0

  if (!hasCommunities) {
    return <WelcomeScreen />
  }

  const communityIds = memberships.map(m => m.community_id)
  const modCommunityIds = memberships
    .filter(m => ['organizer', 'moderator'].includes(m.role))
    .map(m => m.community_id)

  const now = new Date().toISOString()

  const [
    { data: upcomingEvents },
    { data: recentPosts },
    { data: pendingRequests },
  ] = await Promise.all([
    // Upcoming events across all joined communities
    admin
      .from('events')
      .select('id, title, starts_at, community_id, communities(name, slug)')
      .in('community_id', communityIds)
      .gte('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(4),

    // Recent bulletin posts across all joined communities
    admin
      .from('bulletin_posts')
      .select('id, title, published_at, community_id, communities(name, slug), profiles(username, display_name)')
      .in('community_id', communityIds)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(5),

    // Pending join requests for communities where user is mod/organizer
    modCommunityIds.length > 0
      ? admin
          .from('community_members')
          .select('community_id, communities(name, slug)')
          .in('community_id', modCommunityIds)
          .eq('status', 'pending')
      : Promise.resolve({ data: null }),
  ])

  // Group pending by community
  const pendingByCommunity: Record<string, { name: string; slug: string; count: number }> = {}
  for (const p of pendingRequests ?? []) {
    const c = Array.isArray(p.communities) ? p.communities[0] : p.communities
    if (!c) continue
    if (!pendingByCommunity[p.community_id]) {
      pendingByCommunity[p.community_id] = { name: c.name, slug: c.slug, count: 0 }
    }
    pendingByCommunity[p.community_id].count++
  }
  const pendingList = Object.values(pendingByCommunity).filter(p => p.count > 0)

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="lg:grid lg:grid-cols-3 lg:gap-8 space-y-8 lg:space-y-0">

        {/* Left: communities list */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-stone-900 mb-4">Your communities</h1>
            <div className="space-y-3">
              {memberships.map((m) => {
                const community = Array.isArray(m.communities) ? m.communities[0] : m.communities
                if (!community) return null
                return (
                  <Link
                    key={m.community_id}
                    href={`/communities/${community.slug}`}
                    className="block bg-white rounded-xl border border-stone-200 p-4 hover:border-orange-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-medium text-stone-900">{community.name}</h2>
                        {community.description && (
                          <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">{community.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-stone-400 capitalize shrink-0">{m.role}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
            <div className="mt-4 flex gap-4">
              <Link href="/communities/new" className="text-sm text-orange-600 hover:underline font-medium">
                + Create a community
              </Link>
              <Link href="/communities" className="text-sm text-stone-500 hover:text-stone-700">
                Browse all
              </Link>
            </div>
          </div>
        </div>

        {/* Right: activity sidebar */}
        <div className="space-y-6">

          {/* Pending approvals */}
          {pendingList.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Needs attention</h2>
              <div className="space-y-2">
                {pendingList.map(p => (
                  <Link
                    key={p.slug}
                    href={`/communities/${p.slug}/settings`}
                    className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:border-amber-300 transition-colors"
                  >
                    <span className="text-sm font-medium text-stone-800 truncate">{p.name}</span>
                    <span className="ml-3 shrink-0 bg-orange-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {p.count} pending
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming events */}
          {upcomingEvents && upcomingEvents.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Upcoming events</h2>
              <div className="space-y-2">
                {upcomingEvents.map(event => {
                  const community = Array.isArray(event.communities) ? event.communities[0] : event.communities
                  const date = new Date(event.starts_at)
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  return (
                    <Link
                      key={event.id}
                      href={`/communities/${community?.slug}?tab=events`}
                      className="block bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-orange-300 transition-colors"
                    >
                      <p className="text-sm font-medium text-stone-900 line-clamp-1">{event.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{community?.name} · {dateStr} at {timeStr}</p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent bulletin posts */}
          {recentPosts && recentPosts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Recent posts</h2>
              <div className="space-y-2">
                {recentPosts.map(post => {
                  const community = Array.isArray(post.communities) ? post.communities[0] : post.communities
                  const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
                  const date = new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  return (
                    <Link
                      key={post.id}
                      href={`/communities/${community?.slug}?tab=bulletin`}
                      className="block bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-orange-300 transition-colors"
                    >
                      <p className="text-sm font-medium text-stone-900 line-clamp-1">{post.title}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {community?.name} · {author?.display_name ?? author?.username} · {date}
                      </p>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Nothing to show yet */}
          {(!upcomingEvents?.length && !recentPosts?.length && !pendingList.length) && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 text-center text-stone-400 text-sm">
              Activity from your communities will appear here.
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-4xl mb-4">🔥</div>
      <h1 className="text-2xl font-semibold text-stone-900 mb-2">Welcome to Stoke</h1>
      <p className="text-stone-500 max-w-sm mb-8">
        Find a community to belong to, or start one of your own.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/communities/new"
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
        >
          Create a community
        </Link>
        <Link
          href="/communities"
          className="px-5 py-2.5 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-lg border border-stone-200 transition-colors"
        >
          Browse communities
        </Link>
      </div>
    </div>
  )
}
