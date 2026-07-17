import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import QotwManager, { type DraftItem, type PublishedItem } from '@/components/qotw/QotwManager'
import NextPublishPanel from '@/components/qotw/NextPublishPanel'
import { resolveNextPublish } from '@/lib/qotw-schedule'
import { qotwLabel } from '@/lib/qotw'

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

  const items = await admin.from('qotw_items')
    .select('id, title, body, number, planned_for, question_id, published_at, position')
    .eq('community_id', community.id)
    .then(r => r.data ?? [])

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

  // Wire the countdown to the SAME logic the cron uses. Rotation anchors to the last
  // REAL QotW (number > 0, so the QotW-t sentinel 0 never counts); the next undated
  // draft rotates in, or the earliest dated draft jumps the line on its day.
  const lastPublishedAt = rows
    .filter(r => (r.number ?? 0) > 0 && r.published_at)
    .map(r => r.published_at as string)
    .sort()
    .at(-1) ?? null
  const undatedNext = bank.find(b => !b.planned_for) ?? null
  const datedNext = bank
    .filter(b => b.planned_for)
    .sort((a, b) => (a.planned_for! < b.planned_for! ? -1 : 1))[0] ?? null
  const nextPublish = resolveNextPublish({
    lastPublishedAtISO: lastPublishedAt,
    undatedNext: undatedNext ? { id: undatedNext.id, title: undatedNext.title } : null,
    datedNext: datedNext ? { id: datedNext.id, title: datedNext.title, planned_for: datedNext.planned_for! } : null,
  })

  // The current, live Question of the Week = the newest real publish (highest number > 0,
  // so a "QotW-t" test sentinel never shows as current). `published` is already number-desc.
  const currentQotw = published.find(p => p.number > 0) ?? null

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

      {currentQotw ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-orange-600">
            ⭐ Current Question of the Week · {qotwLabel(currentQotw.number)}
          </div>
          <p className="mt-1 text-base font-medium text-stone-900">{currentQotw.title}</p>
          <Link
            href={`/communities/${slug}/qotw/${currentQotw.number}`}
            className="mt-2 inline-block text-sm font-medium text-orange-700 hover:text-orange-900"
          >
            View public page →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
          No Question of the Week has been published yet. Publish one from your queue below.
        </div>
      )}

      <NextPublishPanel next={nextPublish} />

      <QotwManager
        communityId={community.id}
        slug={slug}
        bank={bank}
        published={published}
      />
    </div>
  )
}
