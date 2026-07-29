import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'
import RichContent from '@/components/RichContent'
import { findQotwCategoryId } from '@/lib/qotw'

type Profile = { username: string; display_name: string | null }

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

/**
 * Public read-only view of a single question. A question is exposed here if it is
 * published AND any of: (a) its community is LISTED (a listed community's Q&A is its
 * public shop window), (b) it is filed into the "Question of the Week" category, or
 * (c) a mod explicitly flipped it public (`is_public`). Everything else in the Q&A —
 * and every question in an UNLISTED community — stays private.
 *
 * ⚠️ This is deliberately the SAME rule as the signed-in non-member gate in
 * components/knowledge/QuestionJoinGate.tsx. Keep them identical: if the logged-out
 * rule is narrower, a signed-in visitor sees LESS than a stranger, which is the
 * inversion that bug class keeps producing.
 *
 * ANSWERS ARE NEVER PUBLIC — only the count is surfaced, so joining is what buys the
 * substance. Reached via a middleware rewrite of the canonical
 * /communities/{slug}/questions/{id} URL for logged-out visitors, so shared links stay
 * clean — which is also what makes Silas's Discord `/library` results land on real
 * content instead of a login wall.
 */
async function loadPublicQuestion(slug: string, questionId: string) {
  const admin = createAdminClient()

  const { data: community } = await admin
    .from('communities')
    .select('id, name, slug, is_listed')
    .eq('slug', slug)
    .single()
  if (!community) return null

  const { data: categories } = await admin
    .from('kb_categories')
    .select('id, name')
    .eq('community_id', community.id)
  const qotwCategoryId = findQotwCategoryId(categories ?? [])

  const { data: question } = await admin
    .from('kb_questions')
    .select('id, title, body, status, category_id, is_public, created_at, published_at, profiles!asker_id(username, display_name)')
    .eq('id', questionId)
    .eq('community_id', community.id)
    .maybeSingle()

  const isQotw = !!qotwCategoryId && question?.category_id === qotwCategoryId
  const isPublic = question?.is_public === true
  const isListed = community.is_listed === true

  // Published, and public by at least one of the three routes above.
  if (!question || question.status !== 'published' || (!isListed && !isQotw && !isPublic)) {
    return { community, question: null as null }
  }

  // Only the COUNT is surfaced publicly (answers are gated behind sign-up), so don't even
  // pull the bodies into memory.
  const { data: answers } = await admin
    .from('kb_answers')
    .select('id')
    .eq('question_id', questionId)
    .eq('status', 'published')

  return { community, question, answers: answers ?? [], isQotw }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; questionId: string }>
}): Promise<Metadata> {
  const { slug, questionId } = await params
  const loaded = await loadPublicQuestion(slug, questionId)
  if (!loaded?.question) return { title: 'Question of the Week' }
  const desc = loaded.isQotw
    ? `Answer this week's question in ${loaded.community.name} on Stoke.`
    : `Answer this question in ${loaded.community.name} on Stoke.`
  return {
    title: loaded.question.title,
    description: desc,
    openGraph: {
      title: loaded.question.title,
      description: desc,
      url: `https://stoke.community/communities/${loaded.community.slug}/questions/${loaded.question.id}`,
    },
  }
}

export default async function PublicQuestionPage({
  params,
}: {
  params: Promise<{ slug: string; questionId: string }>
}) {
  const { slug, questionId } = await params
  const loaded = await loadPublicQuestion(slug, questionId)
  if (!loaded) notFound()

  // Not a public QOTW question — send them to the community's public preview instead of
  // leaking a 404 (logged-out /communities/{slug} rewrites to the preview).
  if (!loaded.question) redirect(`/communities/${slug}`)

  const { community, question, answers, isQotw } = loaded
  const canonicalPath = `/communities/${community.slug}/questions/${question.id}`
  const signupHref = `/signup?redirect=${encodeURIComponent(canonicalPath)}`
  const loginHref = `/login?redirect=${encodeURIComponent(canonicalPath)}`

  const asker = one<Profile>(question.profiles)
  const date = new Date(question.published_at ?? question.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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
        {/* Question */}
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            {isQotw ? '⭐ Question of the Week' : `${community.name} · Q&A`}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-stone-900">{question.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-400">
            <Link href={`/communities/${community.slug}`} className="hover:text-orange-600">{community.name}</Link>
            {asker && <span>· asked by {asker.display_name ?? asker.username}</span>}
            <span>· {date}</span>
          </div>
          {question.body && <RichContent content={question.body} className="text-stone-600 text-sm mt-4 whitespace-pre-wrap" />}
        </div>

        {/* Answers are always gated behind sign-up on the public page (QotW included) —
            the count is teased to pull people in; the bodies are never rendered here. */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
          </h2>
          {answers.length === 0 ? (
            <p className="text-sm text-stone-400">No answers yet — be the first to help.</p>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
              <p className="text-sm text-stone-600">
                🔒 {answers.length} {answers.length === 1 ? 'answer has' : 'answers have'} been shared.
              </p>
              <p className="mt-1 text-sm text-stone-500">Sign in to read {answers.length === 1 ? 'it' : 'them'} and add your own.</p>
              <Link
                href={signupHref}
                className="mt-4 inline-block bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                Sign up to read the {answers.length === 1 ? 'answer' : 'answers'}
              </Link>
            </div>
          )}
        </div>

        {/* Sign-up CTA */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          <p className="font-semibold text-stone-900">Have an answer to share?</p>
          <p className="mt-1 text-sm text-stone-500">
            Join {community.name} on Stoke to add your answer and browse the full library of questions.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href={signupHref}
              className="w-full sm:w-auto text-center bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              Sign up to answer
            </Link>
            <Link
              href={loginHref}
              className="w-full sm:w-auto text-center bg-white border border-stone-300 text-stone-700 px-6 py-3 rounded-xl font-semibold hover:bg-stone-50 transition-colors"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
