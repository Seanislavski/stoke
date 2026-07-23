import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RichContent from '@/components/RichContent'
import LinkPreview from '@/components/LinkPreview'
import DeleteItemButton from '@/components/DeleteItemButton'
import AnswerForm from '@/components/knowledge/AnswerForm'
import AnswerModActions from '@/components/knowledge/AnswerModActions'
import QuestionModActions from '@/components/knowledge/QuestionModActions'
import QuestionCategoryPicker from '@/components/knowledge/QuestionCategoryPicker'
import QuestionPublicToggle from '@/components/knowledge/QuestionPublicToggle'
import PublishAsQotwButton from '@/components/qotw/PublishAsQotwButton'
import AcceptAnswerButton from '@/components/knowledge/AcceptAnswerButton'
import EditQuestion from '@/components/knowledge/EditQuestion'
import EditAnswer from '@/components/knowledge/EditAnswer'
import { deleteQuestion, deleteAnswer } from '@/app/actions/knowledge'
import { getYouTubeId } from '@/lib/embeds'
import { qotwLabel } from '@/lib/qotw'

type Profile = { username: string; display_name: string | null }

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ slug: string; questionId: string }>
}) {
  const { slug, questionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, owner_id')
    .eq('slug', slug)
    .single()

  if (!community) notFound()

  const isOwner = user?.id === community.owner_id
  const admin = createAdminClient()

  const [{ data: myMembership }, { data: platformRole }] = await Promise.all([
    supabase
      .from('community_members')
      .select('role, status')
      .eq('community_id', community.id)
      .eq('user_id', user!.id)
      .maybeSingle(),
    admin
      .from('platform_roles')
      .select('role')
      .eq('user_id', user!.id)
      .in('role', ['owner', 'platform_moderator'])
      .maybeSingle(),
  ])

  const isMember = myMembership?.status === 'active'
  const isMod = !!platformRole || isOwner || ['organizer', 'moderator'].includes(myMembership?.role ?? '')
  const canSee = isMember || isMod

  if (!canSee) notFound()

  const { data: question } = await admin
    .from('kb_questions')
    .select('id, title, body, status, category_id, is_public, asker_public_pref, asker_id, attribution, created_at, published_at, profiles!asker_id(username, display_name)')
    .eq('id', questionId)
    .eq('community_id', community.id)
    .single()

  if (!question) notFound()

  const isAsker = question.asker_id === user!.id
  // Pending/rejected questions are only visible to mods and the asker.
  if (question.status !== 'published' && !isMod && !isAsker) notFound()

  const [{ data: category }, { data: answers }, { data: categories }, { data: qotwItem }] = await Promise.all([
    question.category_id
      ? admin.from('kb_categories').select('name').eq('id', question.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('kb_answers')
      .select('id, body, url, status, is_accepted, author_id, attribution, created_at, profiles!author_id(username, display_name)')
      .eq('question_id', questionId)
      .in('status', isMod ? ['published', 'pending'] : ['published'])
      .order('is_accepted', { ascending: false })
      .order('created_at', { ascending: true }),
    isMod
      ? admin.from('kb_categories').select('id, name').eq('community_id', community.id).order('position')
      : Promise.resolve({ data: [] }),
    isMod
      ? admin.from('qotw_items').select('number').eq('community_id', community.id).eq('question_id', questionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // A published QotW question is managed from the QotW manager — route deletion there
  // (its number, numbered link, and answers are all cleaned up together) rather than
  // offering the generic "delete this question" here, which used to orphan the QotW row.
  const isQotw = isMod && qotwItem?.number != null

  const asker = one<Profile>(question.profiles)
  const date = new Date(question.published_at ?? question.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const publishedAnswers = (answers ?? []).filter(a => a.status === 'published')
  const pendingAnswers = (answers ?? []).filter(a => a.status === 'pending')
  const canAccept = isAsker || isMod

  // A QotW question is edit-locked to mods (protects the featured/numbered link). Otherwise
  // the asker edits their own; a member's edit re-queues, a mod's stays live.
  const canEditQuestion = isMod || (isAsker && !isQotw)
  const questionWillRequeue = !isMod && question.status === 'published'

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <Link href={`/communities/${slug}?tab=qa`} className="text-sm text-stone-400 hover:text-stone-700">
        ← Back to Q&amp;A
      </Link>

      {/* Question */}
      <div className="bg-white border border-stone-200 rounded-xl p-6">
        <EditQuestion
          questionId={question.id}
          communityId={community.id}
          slug={slug}
          initialTitle={question.title}
          initialBody={question.body ?? ''}
          willRequeue={questionWillRequeue}
          canEdit={canEditQuestion}
        >
          {question.status !== 'published' && (
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">
              {question.status === 'pending' ? 'Awaiting review' : 'Not approved'}
            </p>
          )}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold text-stone-900">{question.title}</h1>
            {isMod && (
              isQotw ? (
                <Link
                  href={`/communities/${slug}/qotw`}
                  className="shrink-0 text-xs font-medium text-orange-600 hover:text-orange-700 whitespace-nowrap"
                >
                  Manage in QotW →
                </Link>
              ) : (
                <DeleteItemButton
                  action={deleteQuestion.bind(null, question.id, community.id, slug)}
                  confirm="Delete this question and its answers?"
                />
              )
            )}
          </div>
          {isQotw && (
            <span className="inline-block mt-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
              ⭐ {qotwLabel(qotwItem!.number)}
            </span>
          )}
          <div className="flex items-center gap-2 flex-wrap text-xs text-stone-400 mt-2">
            {category?.name && <span className="bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{category.name}</span>}
            {question.attribution ? (
              <span title="Archived from Discord by Silas!, with the author's permission">
                📚 Shared by <span className="font-medium text-stone-600">{question.attribution}</span> on Discord
              </span>
            ) : asker?.username && (
              <Link href={`/profile/${asker.username}`} className="hover:text-orange-600">
                {asker.display_name ?? asker.username}
              </Link>
            )}
            <span>{date}</span>
          </div>
          {question.body && <RichContent content={question.body} className="text-stone-600 text-sm mt-3 whitespace-pre-wrap" />}
        </EditQuestion>

        {question.status === 'pending' && isMod && (
          <QuestionModActions questionId={question.id} communityId={community.id} slug={slug} categories={categories ?? []} />
        )}

        {question.status === 'published' && isMod && (
          <QuestionCategoryPicker
            questionId={question.id}
            communityId={community.id}
            slug={slug}
            categories={categories ?? []}
            currentCategoryId={question.category_id}
          />
        )}

        {/* A QotW question is already public via its numbered link, so the toggle is only
            offered on non-QotW published questions. */}
        {question.status === 'published' && isMod && !isQotw && (
          <QuestionPublicToggle
            questionId={question.id}
            communityId={community.id}
            slug={slug}
            isPublic={question.is_public === true}
            askerPref={question.asker_public_pref ?? null}
          />
        )}

        {/* Promote a member's question straight to a numbered Question of the Week
            (keeps their authorship). Hidden once it already is one. */}
        {isMod && !isQotw && question.status !== 'rejected' && (
          <PublishAsQotwButton
            questionId={question.id}
            communityId={community.id}
            slug={slug}
            isPending={question.status !== 'published'}
          />
        )}
      </div>

      {/* Pending answers — mods only */}
      {isMod && pendingAnswers.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">
            Answers awaiting review ({pendingAnswers.length})
          </p>
          {pendingAnswers.map(a => {
            const author = one<Profile>(a.profiles)
            return (
              <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs text-stone-400 mb-1">
                  {author?.username ? (
                    <Link href={`/profile/${author.username}`} className="hover:text-orange-600">
                      {author.display_name ?? author.username}
                    </Link>
                  ) : 'Unknown'}
                </p>
                <RichContent content={a.body} className="text-stone-600 text-sm whitespace-pre-wrap" embeds={false} />
                {a.url && <LinkPreview url={a.url} />}
                <AnswerModActions answerId={a.id} communityId={community.id} slug={slug} />
              </div>
            )
          })}
        </div>
      )}

      {/* Published answers */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
          {publishedAnswers.length} {publishedAnswers.length === 1 ? 'Answer' : 'Answers'}
        </h2>
        {publishedAnswers.length === 0 ? (
          <p className="text-sm text-stone-400">No answers yet. Be the first to help.</p>
        ) : (
          publishedAnswers.map(a => {
            const author = one<Profile>(a.profiles)
            const aDate = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <div key={a.id} id={`answer-${a.id}`} className={`scroll-mt-20 bg-white border rounded-xl p-4 ${a.is_accepted ? 'border-green-300 ring-1 ring-green-100' : 'border-stone-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    {a.attribution ? (
                      <span title="Archived from Discord by Silas!, with the author's permission">
                        📚 Shared by <span className="font-medium text-stone-600">{a.attribution}</span> on Discord
                      </span>
                    ) : author?.username ? (
                      <Link href={`/profile/${author.username}`} className="font-medium text-stone-600 hover:text-orange-600">
                        {author.display_name ?? author.username}
                      </Link>
                    ) : 'Unknown'}
                    <span>· {aDate}</span>
                    {a.is_accepted && <span className="text-green-700 font-medium">✓ Accepted answer</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canAccept && (
                      <AcceptAnswerButton
                        answerId={a.id}
                        questionId={question.id}
                        communityId={community.id}
                        slug={slug}
                        isAccepted={a.is_accepted}
                      />
                    )}
                    {isMod && (
                      <DeleteItemButton
                        action={deleteAnswer.bind(null, a.id, community.id, slug)}
                        confirm="Delete this answer?"
                      />
                    )}
                  </div>
                </div>
                <EditAnswer
                  answerId={a.id}
                  communityId={community.id}
                  slug={slug}
                  initialBody={a.body}
                  initialUrl={a.url}
                  willRequeue={!isMod}
                  canEdit={a.author_id === user!.id}
                >
                  <RichContent content={a.body} className="text-stone-700 text-sm whitespace-pre-wrap" />
                  {a.url && (
                    getYouTubeId(a.url) ? (
                      <div className="mt-1">
                        <LinkPreview url={a.url} />
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline mt-1 inline-block">
                          Watch on YouTube ↗
                        </a>
                      </div>
                    ) : (
                      <>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline break-all mt-1 block">
                          {a.url}
                        </a>
                        <LinkPreview url={a.url} />
                      </>
                    )
                  )}
                </EditAnswer>
              </div>
            )
          })
        )}
      </div>

      {/* Answer form — only on published questions */}
      {question.status === 'published' && (
        <AnswerForm questionId={question.id} communityId={community.id} slug={slug} isMod={isMod} />
      )}
    </div>
  )
}
