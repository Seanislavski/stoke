import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'

/**
 * Numbered QotW link for logged-in visitors — resolves QotW-N to its question and
 * sends them to the real, answerable question page. Logged-out visitors are handled
 * by a middleware rewrite to the public /preview/{slug}/qotw/{n} view instead.
 */
export default async function QotwNumberedRedirect({
  params,
}: {
  params: Promise<{ slug: string; n: string }>
}) {
  const { slug, n } = await params
  const num = Number.parseInt(n, 10)

  const admin = createAdminClient()
  const { data: community } = await admin.from('communities').select('id').eq('slug', slug).single()
  if (!community) notFound()

  const { data: item } = Number.isNaN(num)
    ? { data: null }
    : await admin.from('qotw_items').select('question_id')
        .eq('community_id', community.id).eq('number', num).maybeSingle()

  if (!item?.question_id) redirect(`/communities/${slug}?tab=qa`)
  redirect(`/communities/${slug}/questions/${item.question_id}`)
}
