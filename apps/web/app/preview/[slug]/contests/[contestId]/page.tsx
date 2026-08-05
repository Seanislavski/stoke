import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'
import RichContent from '@/components/RichContent'
import LocalDate from '@/components/LocalDate'
import { phaseHint, submissionsOpen, CONTEST_STATUS_LABELS, type ContestStatus } from '@/lib/contests'

/**
 * Public read-only view of a contest. Exposed when the contest is not a draft AND
 * its community is LISTED — a listed community's contest is its shop window, and
 * a contest nobody outside can read is a contest nobody outside can enter.
 *
 * ⚠️ This is deliberately the SAME rule as the signed-in non-member gate in
 * app/(app)/communities/[slug]/contests/[contestId]/page.tsx. Keep them identical:
 * if the logged-out rule is narrower, a signed-in visitor sees LESS than a
 * stranger, which is the inversion that bug class keeps producing.
 *
 * ENTRIES ARE NEVER PUBLIC — not even the count, since a contest with zero entries
 * shouldn't advertise that to strangers while it's still collecting them. Reached
 * via a middleware rewrite of the canonical /communities/{slug}/contests/{id} URL,
 * so a link shared to Discord stays clean.
 */
async function loadPublicContest(slug: string, contestId: string) {
  const admin = createAdminClient()

  const { data: community } = await admin
    .from('communities')
    .select('id, name, slug, is_listed, join_mode')
    .eq('slug', slug)
    .single()
  if (!community) return null

  const { data: contest } = await admin
    .from('contests')
    .select('id, title, description, rules, status, submissions_close_at, voting_close_at, created_at')
    .eq('id', contestId)
    .eq('community_id', community.id)
    .maybeSingle()

  if (!contest || contest.status === 'draft' || !community.is_listed) {
    return { community, contest: null as null }
  }

  return { community, contest }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; contestId: string }>
}): Promise<Metadata> {
  const { slug, contestId } = await params
  const loaded = await loadPublicContest(slug, contestId)
  if (!loaded?.contest) return { title: 'Contest' }
  const desc = `Enter the ${loaded.contest.title} contest in ${loaded.community.name} on Stoke.`
  return {
    title: loaded.contest.title,
    description: desc,
    openGraph: {
      title: loaded.contest.title,
      description: desc,
      url: `https://stoke.community/communities/${loaded.community.slug}/contests/${loaded.contest.id}`,
    },
  }
}

export default async function PublicContestPage({
  params,
}: {
  params: Promise<{ slug: string; contestId: string }>
}) {
  const { slug, contestId } = await params
  const loaded = await loadPublicContest(slug, contestId)
  if (!loaded) notFound()

  // Not publicly visible — send them to the community preview rather than a 404.
  if (!loaded.contest) redirect(`/communities/${slug}`)

  const { community, contest } = loaded
  const canonicalPath = `/communities/${community.slug}/contests/${contest.id}`
  const signupHref = `/signup?redirect=${encodeURIComponent(canonicalPath)}`
  const loginHref = `/login?redirect=${encodeURIComponent(canonicalPath)}`
  const open = submissionsOpen(contest)

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <StokeWordmark iconSize={28} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href={loginHref} className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
              Sign in
            </Link>
            <Link href={signupHref} className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            {community.name} · {CONTEST_STATUS_LABELS[contest.status as ContestStatus]}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-stone-900">{contest.title}</h1>
          <p className="mt-2 text-sm text-stone-500">{phaseHint(contest)}</p>

          {contest.description && (
            <div className="mt-4 text-stone-700 text-sm sm:text-base">
              <RichContent content={contest.description} />
            </div>
          )}

          {contest.submissions_close_at && (
            <p className="mt-4 text-xs text-stone-500">
              Entries close <LocalDate ts={contest.submissions_close_at} />
            </p>
          )}
        </div>

        {contest.rules && (
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Rules</p>
            <div className="text-sm text-stone-600"><RichContent content={contest.rules} /></div>
          </div>
        )}

        <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
          <p className="text-sm text-stone-600">
            {open
              ? `Entries are open to members of ${community.name}.`
              : `Entries are closed, but you can still join ${community.name}.`}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {open
              ? 'Create a free account to enter your design.'
              : 'Create a free account to follow the voting.'}
          </p>
          <Link
            href={signupHref}
            className="mt-4 inline-block bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
          >
            {open ? 'Sign up to enter' : 'Sign up to follow along'}
          </Link>
          <p className="mt-4 text-xs text-stone-400">
            Already have an account?{' '}
            <Link href={loginHref} className="hover:text-stone-600 underline">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-stone-400">
          <Link href={`/communities/${community.slug}`} className="hover:text-stone-600 underline">
            About {community.name}
          </Link>
        </p>
      </main>

      <MarketingFooter />
    </div>
  )
}
