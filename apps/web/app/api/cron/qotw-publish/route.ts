import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { releaseDraft } from '@/lib/qotw-publish'
import { revalidatePath } from 'next/cache'

// Question-of-the-Week scheduler. Protected by CRON_SECRET.
// Configure a daily cron (e.g. cron-job.org) to call:
//   GET https://stoke.community/api/cron/qotw-publish
//   Authorization: Bearer <CRON_SECRET>
//
// Hybrid model, per community, at most ONE release per run:
//   1. Date wins — a bank draft whose `planned_for` date has arrived is published
//      (earliest-dated first).
//   2. Else rotate — if no dated draft is due AND it's been >= 7 days since the community's
//      last QotW, the next undated draft (bank order) is published.
// Idempotent: publishing assigns a number, so a draft is never picked twice.

const ROTATE_GAP_MS = 7 * 24 * 60 * 60 * 1000

type Draft = { id: string; community_id: string; title: string; body: string | null; planned_for: string | null; position: number }

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

  // All unpublished bank drafts, oldest-in-bank first.
  const { data: drafts, error } = await admin
    .from('qotw_items')
    .select('id, community_id, title, body, planned_for, position')
    .is('number', null)
    .order('position', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!drafts || drafts.length === 0) return NextResponse.json({ released: 0 })

  const byCommunity = new Map<string, Draft[]>()
  for (const d of drafts as Draft[]) {
    const list = byCommunity.get(d.community_id) ?? []
    list.push(d)
    byCommunity.set(d.community_id, list)
  }

  const releasedSlugs: string[] = []

  for (const [communityId, items] of byCommunity) {
    // 1. Date wins: earliest dated draft that is due.
    const due = items
      .filter(i => i.planned_for && i.planned_for <= today)
      .sort((a, b) => (a.planned_for! < b.planned_for! ? -1 : a.planned_for! > b.planned_for! ? 1 : a.position - b.position))
    let toRelease: Draft | null = due[0] ?? null

    // 2. Else rotate: next undated draft if the weekly gap has elapsed.
    if (!toRelease) {
      const { data: last } = await admin
        .from('qotw_items')
        .select('published_at')
        .eq('community_id', communityId)
        .gt('number', 0)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const okToRotate = !last?.published_at || (Date.now() - new Date(last.published_at).getTime()) >= ROTATE_GAP_MS
      if (okToRotate) {
        toRelease = items.filter(i => !i.planned_for).sort((a, b) => a.position - b.position)[0] ?? null
      }
    }

    if (toRelease) {
      const res = await releaseDraft(admin, communityId, toRelease)
      if (!res.error) {
        const { data: c } = await admin.from('communities').select('slug').eq('id', communityId).single()
        if (c?.slug) releasedSlugs.push(c.slug)
      }
    }
  }

  for (const slug of releasedSlugs) {
    revalidatePath(`/communities/${slug}`)
    revalidatePath(`/communities/${slug}/qotw`)
  }

  return NextResponse.json({ released: releasedSlugs.length })
}
