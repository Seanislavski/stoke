import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'
import RichContent from '@/components/RichContent'
import LinkPreview from '@/components/LinkPreview'
import { getYouTubeId } from '@/lib/embeds'
import { qotwLabel } from '@/lib/qotw'

type Profile = { username: string; display_name: string | null }

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

/**
 * Public read-only view of a numbered Question of the Week (QotW-N). Reached via a
 * middleware rewrite of /communities/{slug}/qotw/{n} for logged-out visitors, so the
 * shared link stays clean. Only published QotW questions are exposed here.
 */
async function loadQotw(slug: string, n: string) {
  const num = Number.parseInt(n, 10)
  const admin = createAdminClient()

  const { data: community } = await admin.from('communities').select('id, name, slug').eq('slug', slug).single()
  if (!community) return null
  if (Number.isNaN(num)) return { community, question: null as null, number: num }

  const { data: item } = await admin.from('qotw_items').select('question_id')
    .eq('community_id', community.id).eq('number', num).maybeSingle()
  if (!item?.question_id) return { community, question: null as null, number: num }

  const { data: question } = await admin
    .from('kb_questions')
    .select('id, title, body, status, created_at, published_at, profiles!asker_id(username, display_name)')
    .eq('id', item.question_id).maybeSingle()
  if (!question || question.status !== 'published') return { community, question: null as null, number: num }

  const { data: answers } = await admin
    .from('kb_answers')
    .select('id, body, url, is_accepted, created_at, profiles!author_id(username, display_name)')
    .eq('question_id', item.question_id)
    .eq('status', 'published')
    .order('is_accepted', { ascending: false })
    .order('created_at', { ascending: true })

  return { community, question, number: num, answers: answers ?? [] }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; n: string }>
}): Promise<Metadata> {
  const { slug, n } = await params
  const loaded = await loadQotw(slug, n)
  if (!loaded?.question) return { title: 'Question of the Week' }
  const desc = `Question of the Week in ${loaded.community.name} on Stoke — add your answer any time.`
  return {
    title: loaded.question.title,
    description: desc,
    openGraph: {
      title: loaded.question.title,
      description: desc,
      url: `https://stoke.community/communities/${loaded.community.slug}/qotw/${loaded.number}`,
    },
  }
}

export default async function PublicQotwPage({
  params,
}: {
  params: Promise<{ slug: string; n: string }>
}) {
  const { slug, n } = await params
  const loaded = await loadQotw(slug, n)
  if (!loaded) notFound()
  if (!loaded.question) redirect(`/communities/${slug}`)

  const { community, question, number, answers } = loaded
  const canonicalPath = `/communities/${community.slug}/qotw/${number}`
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
            <Link href={loginHref} className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">Sign in</Link>
            <Link href={signupHref} className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">Get started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">⭐ Question of the Week · {qotwLabel(number)}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-stone-900">{question.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-400">
            <Link href={`/communities/${community.slug}`} className="hover:text-orange-600">{community.name}</Link>
            {asker && <span>· asked by {asker.display_name ?? asker.username}</span>}
            <span>· {date}</span>
          </div>
          {question.body && <RichContent content={question.body} className="text-stone-600 text-sm mt-4 whitespace-pre-wrap" />}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
          </h2>
          {answers.length === 0 ? (
            <p className="text-sm text-stone-400">No answers yet — be the first to help.</p>
          ) : (
            answers.map(a => {
              const author = one<Profile>(a.profiles)
              const aDate = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <div key={a.id} className={`bg-white border rounded-xl p-4 ${a.is_accepted ? 'border-green-300 ring-1 ring-green-100' : 'border-stone-200'}`}>
                  <div className="flex items-center gap-2 text-xs text-stone-400 mb-2">
                    <span className="font-medium text-stone-600">{author ? (author.display_name ?? author.username) : 'Member'}</span>
                    <span>· {aDate}</span>
                    {a.is_accepted && <span className="text-green-700 font-medium">✓ Accepted answer</span>}
                  </div>
                  <RichContent content={a.body} className="text-stone-700 text-sm whitespace-pre-wrap" />
                  {a.url && (
                    getYouTubeId(a.url) ? (
                      <div className="mt-1">
                        <LinkPreview url={a.url} />
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline mt-1 inline-block">Watch on YouTube ↗</a>
                      </div>
                    ) : (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline break-all mt-1 block">{a.url}</a>
                    )
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          <p className="font-semibold text-stone-900">Have an answer to share?</p>
          <p className="mt-1 text-sm text-stone-500">
            Join {community.name} on Stoke to add your answer — there&apos;s no deadline, answer whenever it suits you.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
            <Link href={signupHref} className="w-full sm:w-auto text-center bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors">Sign up to answer</Link>
            <Link href={loginHref} className="w-full sm:w-auto text-center bg-white border border-stone-300 text-stone-700 px-6 py-3 rounded-xl font-semibold hover:bg-stone-50 transition-colors">I already have an account</Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
