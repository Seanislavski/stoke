import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('community_members')
    .select('community_id, role, joined_at, communities(id, name, slug, description, category_id)')
    .eq('user_id', user!.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })

  const hasCommunities = memberships && memberships.length > 0

  if (!hasCommunities) {
    return <WelcomeScreen />
  }

  return <ActivityFeed memberships={memberships} />
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

type Membership = {
  community_id: string
  role: string
  joined_at: string
  communities: {
    id: string
    name: string
    slug: string
    description: string | null
    category_id: string | null
  }[] | null
}

function ActivityFeed({ memberships }: { memberships: Membership[] }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900 mb-6">Your communities</h1>
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-stone-900">{community.name}</h2>
                  {community.description && (
                    <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">
                      {community.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-stone-400 capitalize ml-4 shrink-0">{m.role}</span>
              </div>
            </Link>
          )
        })}
      </div>
      <div className="mt-8 flex gap-3">
        <Link
          href="/communities/new"
          className="text-sm text-orange-600 hover:underline font-medium"
        >
          + Create a community
        </Link>
        <Link
          href="/communities"
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          Browse all communities
        </Link>
      </div>
    </div>
  )
}
