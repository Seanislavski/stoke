import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import ListedToggle from '@/components/admin/ListedToggle'

export default async function AdminCommunitiesPage() {
  const admin = createAdminClient()

  const { data: communities } = await admin
    .from('communities')
    .select('id, name, slug, description, join_mode, is_listed, created_at')
    .order('created_at', { ascending: false })

  const communityIds = communities?.map(c => c.id) ?? []
  const { data: memberCounts } = communityIds.length
    ? await admin
        .from('community_members')
        .select('community_id')
        .in('community_id', communityIds)
        .eq('status', 'active')
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const row of memberCounts ?? []) {
    countMap[row.community_id] = (countMap[row.community_id] ?? 0) + 1
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-900">Communities</h1>
        <span className="text-sm text-stone-400">{communities?.length ?? 0} total</span>
      </div>

      <div className="space-y-2">
        {communities?.map(c => (
          <div key={c.id} className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/communities/${c.slug}`}
                  className="text-sm font-medium text-stone-900 hover:underline"
                >
                  {c.name}
                </Link>
                <span className="text-xs text-stone-400">/{c.slug}</span>
                <span className="text-xs text-stone-400 capitalize bg-stone-100 px-1.5 py-0.5 rounded">
                  {c.join_mode.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                {countMap[c.id] ?? 0} members · Created {new Date(c.created_at).toLocaleDateString('en-US')}
              </p>
            </div>
            <ListedToggle communityId={c.id} isListed={c.is_listed} />
          </div>
        ))}
      </div>
    </div>
  )
}
