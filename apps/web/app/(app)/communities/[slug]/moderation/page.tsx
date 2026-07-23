import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import RichContent from '@/components/RichContent'
import PhotoGallery from '@/components/PhotoGallery'
import ModActions from '@/components/bulletin/ModActions'
import QuestionModActions from '@/components/knowledge/QuestionModActions'
import AnswerModActions from '@/components/knowledge/AnswerModActions'
import QueueActions from '@/components/community/QueueActions'
import CaptureActions from '@/components/community/CaptureActions'
import { approveRequest, rejectRequest } from '@/app/actions/community'
import { approveReview, rejectReview } from '@/app/actions/reviews'

type Profile = { username: string; display_name: string | null }
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}
function nameOf(p: Profile | null) {
  return p ? (p.display_name ?? p.username) : 'Unknown'
}
function when(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function ModerationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, owner_id')
    .eq('slug', slug)
    .single()
  if (!community) notFound()

  const isOwner = user.id === community.owner_id
  const admin = createAdminClient()
  const [{ data: membership }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('role').eq('community_id', community.id).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isMod = !!platformRole || isOwner || ['organizer', 'moderator'].includes(membership?.role ?? '')
  if (!isMod) redirect(`/communities/${slug}`)

  const [reqRows, postRows, questionRows, answerRows, reviewRows, kbCats] = await Promise.all([
    admin.from('community_members')
      .select('user_id, profiles(username, display_name)')
      .eq('community_id', community.id).eq('status', 'pending')
      .then(r => r.data ?? []),
    admin.from('bulletin_posts')
      .select('id, title, content, photos, created_at, profiles(username, display_name)')
      .eq('community_id', community.id).eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(r => r.data ?? []),
    admin.from('kb_questions')
      .select('id, title, body, created_at, profiles!asker_id(username, display_name)')
      .eq('community_id', community.id).eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(r => r.data ?? []),
    admin.from('kb_answers')
      .select('id, body, url, question_id, created_at, profiles!author_id(username, display_name)')
      .eq('community_id', community.id).eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(r => r.data ?? []),
    admin.from('reviews')
      .select('id, rating, body, created_at, profiles!author_id(username, display_name)')
      .eq('community_id', community.id).eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(r => r.data ?? []),
    admin.from('kb_categories')
      .select('id, name')
      .eq('community_id', community.id).order('position')
      .then(r => r.data ?? []),
  ])

  // Discord captures with consent granted but not yet filed into the KB
  // (fail-safe: a missing discord_captures table just yields an empty inbox),
  // plus the published questions the filing picker offers.
  const [captureRows, publishedQuestions] = await Promise.all([
    admin.from('discord_captures')
      .select('id, content, discord_author_name, discord_message_url, consent_status, consent_answered_at')
      .eq('community_id', community.id)
      .in('consent_status', ['granted_credited', 'granted_anon'])
      .is('question_id', null).is('answer_id', null)
      .order('consent_answered_at', { ascending: true })
      .then(r => r.data ?? []),
    admin.from('kb_questions')
      .select('id, title')
      .eq('community_id', community.id).eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(r => r.data ?? []),
  ])

  // Question titles for the pending answers (so a mod sees which question each is on).
  const qIds = [...new Set(answerRows.map((a: { question_id: string }) => a.question_id))]
  const { data: qTitles } = qIds.length
    ? await admin.from('kb_questions').select('id, title').in('id', qIds)
    : { data: [] as { id: string; title: string }[] }
  const titleById = new Map((qTitles ?? []).map(q => [q.id, q.title]))

  const total = reqRows.length + postRows.length + questionRows.length + answerRows.length + reviewRows.length + captureRows.length

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6 px-4">
      <div>
        <Link href={`/communities/${slug}`} className="text-sm text-stone-400 hover:text-stone-700">
          ← Back to {community.name}
        </Link>
        <h1 className="text-2xl font-semibold text-stone-900 mt-2">Review queue</h1>
        <p className="text-sm text-stone-500 mt-1">
          Everything waiting on a moderator, in one place. Approve or reject each item.
        </p>
      </div>

      {total === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-stone-700 font-medium">All clear</p>
          <p className="text-sm text-stone-500 mt-1">Nothing is waiting for review right now.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Join requests */}
          {reqRows.length > 0 && (
            <Section title="Join requests" count={reqRows.length}>
              {reqRows.map((m: { user_id: string; profiles: Profile | Profile[] | null }) => {
                const p = one<Profile>(m.profiles)
                return (
                  <Card key={m.user_id}>
                    <p className="text-sm text-stone-800 font-medium">{nameOf(p)}</p>
                    {p?.username && <p className="text-xs text-stone-400">@{p.username}</p>}
                    <QueueActions
                      approve={approveRequest.bind(null, community.id, slug, m.user_id)}
                      reject={rejectRequest.bind(null, community.id, slug, m.user_id)}
                    />
                  </Card>
                )
              })}
            </Section>
          )}

          {/* Bulletin posts */}
          {postRows.length > 0 && (
            <Section title="Bulletin posts" count={postRows.length}>
              {postRows.map((post: { id: string; title: string | null; content: string; photos: string[] | null; created_at: string; profiles: Profile | Profile[] | null }) => (
                <Card key={post.id}>
                  <Meta name={nameOf(one<Profile>(post.profiles))} date={post.created_at} />
                  {post.title && <p className="font-medium text-stone-800 text-sm mt-1">{post.title}</p>}
                  <RichContent content={post.content} className="text-stone-600 text-sm mt-1 whitespace-pre-wrap" />
                  {post.photos && post.photos.length > 0 && <div className="mt-2"><PhotoGallery photos={post.photos} /></div>}
                  <ModActions postId={post.id} communityId={community.id} slug={slug} />
                </Card>
              ))}
            </Section>
          )}

          {/* Q&A questions */}
          {questionRows.length > 0 && (
            <Section title="Questions" count={questionRows.length}>
              {questionRows.map((q: { id: string; title: string; body: string | null; created_at: string; profiles: Profile | Profile[] | null }) => (
                <Card key={q.id}>
                  <Meta name={nameOf(one<Profile>(q.profiles))} date={q.created_at} />
                  <Link href={`/communities/${slug}/questions/${q.id}`} className="font-medium text-stone-800 text-sm mt-1 block hover:text-orange-600">
                    {q.title}
                  </Link>
                  {q.body && <RichContent content={q.body} className="text-stone-600 text-sm mt-1 whitespace-pre-wrap" embeds={false} />}
                  <QuestionModActions questionId={q.id} communityId={community.id} slug={slug} categories={kbCats} />
                </Card>
              ))}
            </Section>
          )}

          {/* Q&A answers */}
          {answerRows.length > 0 && (
            <Section title="Answers" count={answerRows.length}>
              {answerRows.map((a: { id: string; body: string; url: string | null; question_id: string; created_at: string; profiles: Profile | Profile[] | null }) => (
                <Card key={a.id}>
                  <Meta name={nameOf(one<Profile>(a.profiles))} date={a.created_at} />
                  <Link href={`/communities/${slug}/questions/${a.question_id}`} className="text-xs text-stone-400 mt-1 block hover:text-orange-600">
                    Answer to: {titleById.get(a.question_id) ?? 'a question'}
                  </Link>
                  <RichContent content={a.body} className="text-stone-600 text-sm mt-1 whitespace-pre-wrap" embeds={false} />
                  {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline break-all mt-1 block">{a.url}</a>}
                  <AnswerModActions answerId={a.id} communityId={community.id} slug={slug} />
                </Card>
              ))}
            </Section>
          )}

          {/* Discord captures — consent granted, waiting to be filed into the library */}
          {captureRows.length > 0 && (
            <Section title="Discord captures" count={captureRows.length}>
              {captureRows.map((c: { id: string; content: string; discord_author_name: string; discord_message_url: string; consent_status: string; consent_answered_at: string | null }) => (
                <Card key={c.id}>
                  <p className="text-xs text-stone-400">
                    <span className="font-medium text-stone-600">
                      {c.consent_status === 'granted_credited' ? c.discord_author_name : 'Anonymous (by request)'}
                    </span>
                    {' '}· shared on Discord
                    {c.consent_answered_at && <> · consented {when(c.consent_answered_at)}</>}
                    {' · '}
                    <a href={c.discord_message_url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
                      original ↗
                    </a>
                  </p>
                  <RichContent content={c.content} className="text-stone-600 text-sm mt-2 whitespace-pre-wrap" embeds={false} />
                  <CaptureActions
                    captureId={c.id}
                    communityId={community.id}
                    slug={slug}
                    questions={publishedQuestions}
                  />
                </Card>
              ))}
            </Section>
          )}

          {/* Reviews */}
          {reviewRows.length > 0 && (
            <Section title="Reviews" count={reviewRows.length}>
              {reviewRows.map((r: { id: string; rating: number | null; body: string; created_at: string; profiles: Profile | Profile[] | null }) => (
                <Card key={r.id}>
                  <Meta name={nameOf(one<Profile>(r.profiles))} date={r.created_at} />
                  {r.rating != null && <p className="text-sm text-amber-500 mt-1">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>}
                  <p className="text-stone-600 text-sm mt-1 whitespace-pre-wrap">{r.body}</p>
                  <QueueActions
                    approve={approveReview.bind(null, r.id, community.id, slug)}
                    reject={rejectReview.bind(null, r.id, community.id, slug)}
                  />
                </Card>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
        {title} <span className="text-orange-600">({count})</span>
      </h2>
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-stone-200 rounded-xl p-4">{children}</div>
}

function Meta({ name, date }: { name: string; date: string }) {
  return (
    <p className="text-xs text-stone-400">
      <span className="font-medium text-stone-600">{name}</span> · {when(date)}
    </p>
  )
}
