import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import QotwManager, { type DraftItem, type PublishedItem } from '@/components/qotw/QotwManager'
import { findQotwCategoryId } from '@/lib/qotw'

export default async function QotwManagePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: community } = await supabase
    .from('communities').select('id, name, slug, owner_id').eq('slug', slug).single()
  if (!community) notFound()

  const admin = createAdminClient()
  const [{ data: membership }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', community.id).eq('user_id', user.id).maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isOwner = user.id === community.owner_id
  const isMod = !!platformRole || isOwner || ['organizer', 'moderator'].includes(membership?.role ?? '')
  if (!isMod) redirect(`/communities/${slug}`)

  const [items, cats] = await Promise.all([
    admin.from('qotw_items')
      .select('id, title, body, number, planned_for, question_id, published_at, position')
      .eq('community_id', community.id)
      .then(r => r.data ?? []),
    admin.from('kb_categories').select('id, name').eq('community_id', community.id).then(r => r.data ?? []),
  ])

  type Row = { id: string; title: string; body: string | null; number: number | null; planned_for: string | null; question_id: string | null; published_at: string | null; position: number }
  const rows = items as Row[]

  const bank: DraftItem[] = rows
    .filter(r => r.number == null)
    .sort((a, b) => a.position - b.position)
    .map(r => ({ id: r.id, title: r.title, body: r.body, planned_for: r.planned_for }))

  const published: PublishedItem[] = rows
    .filter(r => r.number != null)
    .sort((a, b) => (b.number ?? 0) - (a.number ?? 0))
    .map(r => ({ id: r.id, number: r.number as number, title: r.title, question_id: r.question_id, published_at: r.published_at }))

  const hasCategory = findQotwCategoryId(cats as { id: string; name: string }[]) != null

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <Link href={`/communities/${slug}?tab=qa`} className="text-sm text-stone-400 hover:text-stone-700">
        ← Back to {community.name}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Question of the Week</h1>
        <p className="text-sm text-stone-500 mt-1">
          Write questions ahead of time, then publish one when you&apos;re ready. Every published question keeps a
          permanent <strong>/qotw/N</strong> link and stays open to answers — no deadlines.
        </p>
      </div>

      <QotwManager
        communityId={community.id}
        slug={slug}
        hasCategory={hasCategory}
        bank={bank}
        published={published}
      />
    </div>
  )
}
