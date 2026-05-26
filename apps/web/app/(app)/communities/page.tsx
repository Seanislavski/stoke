import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type SearchParams = Promise<{ q?: string; category?: string }>

export default async function CommunitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, category } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // fetch categories for filter bar
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('is_approved', true)
    .order('name')

  // fetch listed communities
  let query = supabase
    .from('communities')
    .select('id, name, slug, description, join_mode, category_id')
    .eq('is_listed', true)
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  }

  if (category) {
    const cat = categories?.find(c => c.slug === category)
    if (cat) query = query.eq('category_id', cat.id)
  }

  const { data: communities } = await query

  // fetch user's memberships to show join status
  const { data: myMemberships } = await supabase
    .from('community_members')
    .select('community_id, status')
    .eq('user_id', user!.id)

  const membershipMap = new Map(myMemberships?.map(m => [m.community_id, m.status]) ?? [])

  const joinModeLabel: Record<string, string> = {
    open: 'Open',
    request: 'Request to join',
    invite_only: 'Invite only',
  }

  return (
    <div className="py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Discover communities</h1>
          <p className="text-stone-500 text-sm mt-1">Find your people.</p>
        </div>
        <Link
          href="/communities/new"
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Create
        </Link>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2">
        <input
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="Search communities…"
          className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
        />
        {category && <input type="hidden" name="category" value={category} />}
        <button
          type="submit"
          className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Search
        </button>
      </form>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={q ? `/communities?q=${encodeURIComponent(q)}` : '/communities'}
          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
            !category
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
          }`}
        >
          All
        </Link>
        {categories?.map(cat => (
          <Link
            key={cat.id}
            href={`/communities?category=${cat.slug}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              category === cat.slug
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
            }`}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {/* Results */}
      {!communities?.length ? (
        <div className="text-center py-16 text-stone-400">
          <p className="text-lg mb-1">No communities found</p>
          <p className="text-sm">
            {q || category ? 'Try a different search or category.' : 'Be the first to start one.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {communities.map(community => {
            const status = membershipMap.get(community.id)
            const catName = categories?.find(c => c.id === community.category_id)?.name

            return (
              <Link
                key={community.id}
                href={`/communities/${community.slug}`}
                className="block bg-white rounded-xl border border-stone-200 p-5 hover:border-orange-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="font-semibold text-stone-900 leading-snug">{community.name}</h2>
                  {status === 'active' && (
                    <span className="shrink-0 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                      Joined
                    </span>
                  )}
                  {status === 'pending' && (
                    <span className="shrink-0 text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                      Pending
                    </span>
                  )}
                </div>
                {community.description && (
                  <p className="text-sm text-stone-500 line-clamp-2 mb-3">{community.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  {catName && <span>{catName}</span>}
                  {catName && <span>·</span>}
                  <span>{joinModeLabel[community.join_mode]}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
