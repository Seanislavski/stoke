import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import JoinButton from '@/components/community/JoinButton'
import CommunityGear from '@/components/community/CommunityGear'
import SubmitPostForm from '@/components/bulletin/SubmitPostForm'
import ModActions from '@/components/bulletin/ModActions'
import CreateEventButton from '@/components/events/CreateEventButton'
import RsvpButton from '@/components/events/RsvpButton'
import EventDeleteControl from '@/components/events/EventDeleteControl'
import DeleteItemButton from '@/components/DeleteItemButton'
import RichContent from '@/components/RichContent'
import PhotoGallery from '@/components/PhotoGallery'
import { deletePost } from '@/app/actions/bulletin'
import AskQuestionForm from '@/components/knowledge/AskQuestionForm'
import KnowledgeBoard, { type BoardQuestion } from '@/components/knowledge/KnowledgeBoard'
import { findQotwCategoryId } from '@/lib/qotw'
import QuestionModActions from '@/components/knowledge/QuestionModActions'
import ReviewForm from '@/components/reviews/ReviewForm'
import ReviewList from '@/components/reviews/ReviewList'
import { REVIEW_COLS, mapReview, type RawReview } from '@/lib/reviews'
import OnboardingChecklist from '@/components/community/OnboardingChecklist'
import { formatEventDate, formatEventTime, tzAbbrev, DEFAULT_TZ } from '@/lib/eventTime'

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { slug } = await params
  const { tab = 'bulletin' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, description, join_mode, is_listed, owner_id, category_id, image_url')
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
  const isPlatformStaff = !!platformRole
  const isMod = isPlatformStaff || isOwner || ['organizer', 'moderator'].includes(myMembership?.role ?? '')
  const canSee = isMember || isMod

  // Always fetch: members (for count + list), pending/banned counts for gear
  const [
    { data: members },
    { count: pendingCount },
    { count: bannedCount },
    { count: pendingReviewsCount },
    { count: pendingPostsCount },
    { count: pendingQuestionsCount },
    { count: pendingAnswersCount },
  ] = await Promise.all([
    canSee
      ? admin.from('community_members')
          .select('user_id, role, profiles(username, display_name, avatar_url)')
          .eq('community_id', community.id)
          .eq('status', 'active')
          .order('role')
      : Promise.resolve({ data: null }),
    isMod
      ? admin.from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    isMod
      ? admin.from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('status', 'banned')
      : Promise.resolve({ count: 0 }),
    isMod
      ? admin.from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    isMod
      ? admin.from('bulletin_posts')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    isMod
      ? admin.from('kb_questions')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    isMod
      ? admin.from('kb_answers')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
  ])

  // Total items waiting on a mod — drives the gear badge + review-queue link.
  const totalPending = (pendingCount ?? 0) + (pendingReviewsCount ?? 0) + (pendingPostsCount ?? 0) + (pendingQuestionsCount ?? 0) + (pendingAnswersCount ?? 0)

  // Onboarding checklist data (organizers only)
  const [onboardingPostCount, onboardingChannelCount, onboardingEventCount] = isMod
    ? await Promise.all([
        admin.from('bulletin_posts').select('*', { count: 'exact', head: true }).eq('community_id', community.id).eq('status', 'published').then(r => r.count ?? 0),
        admin.from('channels').select('*', { count: 'exact', head: true }).eq('community_id', community.id).then(r => r.count ?? 0),
        admin.from('events').select('*', { count: 'exact', head: true }).eq('community_id', community.id).then(r => r.count ?? 0),
      ])
    : [0, 0, 0]

  // Bulletin tab data
  const [publishedPosts, pendingPosts] = await Promise.all([
    (tab === 'bulletin' && canSee)
      ? admin.from('bulletin_posts')
          .select('id, title, content, photos, published_at, profiles(username, display_name)')
          .eq('community_id', community.id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .then(r => r.data)
      : Promise.resolve(null),
    (tab === 'bulletin' && isMod)
      ? admin.from('bulletin_posts')
          .select('id, title, content, photos, created_at, profiles(username, display_name)')
          .eq('community_id', community.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .then(r => r.data)
      : Promise.resolve(null),
  ])

  // Channels tab data
  const channels = (tab === 'channels' && canSee)
    ? (await admin.from('channels')
        .select('id, name, description')
        .eq('community_id', community.id)
        .order('position')
        .order('created_at')).data
    : null

  // Q&A (knowledge base) tab data
  const [kbCategories, kbPublishedRaw, kbPending, kbAnswerRows] = await Promise.all([
    (tab === 'qa' && canSee)
      ? admin.from('kb_categories')
          .select('id, name')
          .eq('community_id', community.id)
          .order('position')
          .then(r => r.data ?? [])
      : Promise.resolve([]),
    (tab === 'qa' && canSee)
      ? admin.from('kb_questions')
          .select('id, title, body, category_id, created_at, profiles!asker_id(username, display_name)')
          .eq('community_id', community.id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .then(r => r.data ?? [])
      : Promise.resolve([]),
    (tab === 'qa' && isMod)
      ? admin.from('kb_questions')
          .select('id, title, body, created_at, profiles!asker_id(username, display_name)')
          .eq('community_id', community.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .then(r => r.data ?? [])
      : Promise.resolve([]),
    (tab === 'qa' && canSee)
      ? admin.from('kb_answers')
          .select('question_id, is_accepted')
          .eq('community_id', community.id)
          .eq('status', 'published')
          .then(r => r.data ?? [])
      : Promise.resolve([]),
  ])

  // Tally answer counts + accepted flag per question
  const answerCounts: Record<string, number> = {}
  const hasAccepted: Record<string, boolean> = {}
  for (const row of kbAnswerRows as { question_id: string; is_accepted: boolean }[]) {
    answerCounts[row.question_id] = (answerCounts[row.question_id] ?? 0) + 1
    if (row.is_accepted) hasAccepted[row.question_id] = true
  }

  const boardQuestions: BoardQuestion[] = (kbPublishedRaw as Array<{
    id: string; title: string; body: string | null; category_id: string | null; created_at: string
    profiles: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null
  }>).map(q => {
    const asker = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles
    return {
      id: q.id,
      title: q.title,
      body: q.body,
      category_id: q.category_id,
      asker_name: asker?.display_name ?? null,
      asker_username: asker?.username ?? null,
      created_at: q.created_at,
      answer_count: answerCounts[q.id] ?? 0,
      has_accepted: hasAccepted[q.id] ?? false,
    }
  })

  // Question of the Week: the newest published question in the QOTW category (if any).
  // boardQuestions is already ordered published_at desc, so the first match is current.
  const qotwCategoryId = findQotwCategoryId(kbCategories)
  const qotwSpotlight = qotwCategoryId
    ? boardQuestions.find(q => q.category_id === qotwCategoryId) ?? null
    : null

  // Reviews tab data — members see published reviews here; mods curate in settings.
  const [reviewsPublishedRaw, myReviewRaw] = await Promise.all([
    (tab === 'reviews' && canSee)
      ? admin.from('reviews').select(REVIEW_COLS)
          .eq('community_id', community.id).eq('status', 'published')
          .order('is_featured', { ascending: false })
          .order('featured_position', { ascending: true })
          .order('published_at', { ascending: false })
          .then(r => r.data ?? [])
      : Promise.resolve([]),
    (tab === 'reviews' && canSee)
      ? admin.from('reviews').select('id, body, rating, status')
          .eq('community_id', community.id).eq('author_id', user!.id)
          .maybeSingle()
          .then(r => r.data)
      : Promise.resolve(null),
  ])

  const publishedReviews = ((reviewsPublishedRaw ?? []) as RawReview[]).map(mapReview)
  const myReview = myReviewRaw as { id: string; body: string; rating: number | null; status: 'pending' | 'published' | 'rejected' } | null
  const myMember = members?.find(m => m.user_id === user!.id)
  const myProfile = myMember ? (Array.isArray(myMember.profiles) ? myMember.profiles[0] : myMember.profiles) : null
  const myUsername = (myProfile as { username?: string } | null)?.username ?? null

  // Events tab data
  let events: Event[] | null = null
  let rsvpCountMap: Record<string, { yes: number; maybe: number; no: number }> = {}
  let myRsvpMap: Record<string, string> = {}
  let viewerTz = DEFAULT_TZ

  if (tab === 'events' && canSee) {
    const { data: viewerProfile } = await admin
      .from('profiles').select('timezone').eq('id', user!.id).maybeSingle()
    viewerTz = viewerProfile?.timezone || DEFAULT_TZ

    const { data: eventsData } = await admin
      .from('events')
      .select('id, title, description, starts_at, ends_at, location_type, location_online, location_address, created_by, photos, series_id, recurrence')
      .eq('community_id', community.id)
      .order('starts_at', { ascending: true })

    events = eventsData as Event[] | null

    if (events?.length) {
      const eventIds = events.map(e => e.id)
      const [{ data: allRsvps }, { data: myRsvps }] = await Promise.all([
        admin.from('event_rsvps').select('event_id, status').in('event_id', eventIds),
        admin.from('event_rsvps').select('event_id, status').eq('user_id', user!.id).in('event_id', eventIds),
      ])

      for (const r of allRsvps ?? []) {
        if (!rsvpCountMap[r.event_id]) rsvpCountMap[r.event_id] = { yes: 0, maybe: 0, no: 0 }
        rsvpCountMap[r.event_id][r.status as 'yes' | 'maybe' | 'no']++
      }
      for (const r of myRsvps ?? []) {
        myRsvpMap[r.event_id] = r.status
      }
    }
  }

  const joinModeLabel: Record<string, string> = {
    open: 'Open',
    request: 'Request to join',
    invite_only: 'Invite only',
  }

  const TABS = [
    { key: 'bulletin', label: 'Bulletin' },
    { key: 'events', label: 'Events' },
    { key: 'qa', label: 'Q&A' },
    { key: 'channels', label: 'Channels' },
    { key: 'reviews', label: 'Reviews' },
  ]

  const now = new Date()

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">

      {/* Header */}
      <div className="relative bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {community.image_url && (
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-stone-100 photo-pop">
                <Image src={community.image_url} alt={community.name} width={64} height={64} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-stone-900">{community.name}</h1>
            {community.description && (
              <p className="mt-2 text-stone-500">{community.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-400">
              <span>{joinModeLabel[community.join_mode]}</span>
              <span>·</span>
              <span>{community.is_listed ? 'Listed' : 'Unlisted'}</span>
              {members && (
                <>
                  <span>·</span>
                  <span>{members.length} {members.length === 1 ? 'member' : 'members'}</span>
                </>
              )}
            </div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <JoinButton
              communityId={community.id}
              joinMode={community.join_mode}
              slug={community.slug}
              memberStatus={myMembership?.status ?? null}
              isOwner={isOwner}
              role={myMembership?.role ?? null}
            />
            {isMod && (
              <CommunityGear
                slug={slug}
                pendingCount={totalPending}
              />
            )}
          </div>
        </div>
      </div>

      {/* Onboarding checklist — organizers only, disappears when all steps done */}
      {isMod && (
        <OnboardingChecklist
          slug={slug}
          hasPost={onboardingPostCount > 0}
          hasChannel={onboardingChannelCount > 0}
          hasMember={(members?.length ?? 0) > 1}
          hasEvent={onboardingEventCount > 0}
        />
      )}

      {/* Gate: non-members */}
      {!canSee && (
        <div className="bg-stone-100 rounded-xl p-6 text-center text-stone-500 text-sm">
          Join this community to see the bulletin board, events, channels, and members.
        </div>
      )}

      {/* Main content + members sidebar */}
      {canSee && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-6 items-start">
          {/* Main column: tabs + content */}
          <div className="min-w-0">
          <div className="flex border-b border-stone-200 mb-6 overflow-x-auto">
            {TABS.map(t => (
              <Link
                key={t.key}
                href={`/communities/${slug}?tab=${t.key}`}
                className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {/* Bulletin tab */}
          {tab === 'bulletin' && (
            <div className="space-y-4">
              {isMod && pendingPosts && pendingPosts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                    Awaiting review ({pendingPosts.length})
                  </p>
                  {pendingPosts.map(post => {
                    const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
                    return (
                      <div key={post.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-xs text-stone-400 mb-1">
                          {author?.username ? (
                            <Link href={`/profile/${author.username}`} className="hover:text-orange-600">
                              {author.display_name ?? author.username}
                            </Link>
                          ) : 'Unknown'}
                        </p>
                        <h3 className="font-medium text-stone-900 text-sm">{post.title}</h3>
                        {post.content && <RichContent content={post.content} className="text-stone-600 text-sm mt-1 whitespace-pre-wrap" />}
                        <PhotoGallery photos={post.photos ?? []} />
                        <ModActions postId={post.id} communityId={community.id} slug={community.slug} />
                      </div>
                    )
                  })}
                </div>
              )}

              {publishedPosts && publishedPosts.length > 0 ? (
                <div className="space-y-3">
                  {publishedPosts.map(post => {
                    const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
                    const date = post.published_at
                      ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : ''
                    return (
                      <div key={post.id} className="bg-white border border-stone-200 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 text-xs text-stone-400">
                            <span>
                              {author?.username ? (
                                <Link href={`/profile/${author.username}`} className="hover:text-orange-600">
                                  {author.display_name ?? author.username}
                                </Link>
                              ) : 'Unknown'}
                            </span>
                            {date && <><span>·</span><span>{date}</span></>}
                          </div>
                          {isMod && (
                            <DeleteItemButton
                              action={deletePost.bind(null, post.id, community.id, slug)}
                              confirm="Delete this post?"
                            />
                          )}
                        </div>
                        <h3 className="font-semibold text-stone-900">{post.title}</h3>
                        {post.content && <RichContent content={post.content} className="text-stone-600 text-sm mt-1 whitespace-pre-wrap" />}
                        <PhotoGallery photos={post.photos ?? []} />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
                  No posts yet.
                </div>
              )}

              <SubmitPostForm communityId={community.id} slug={community.slug} isMod={isMod} />
            </div>
          )}

          {/* Events tab */}
          {tab === 'events' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {isMod && <CreateEventButton communityId={community.id} />}
              </div>

              {!events?.length ? (
                <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
                  No events yet.{isMod ? ' Create the first one!' : ''}
                </div>
              ) : (
                <>
                  {/* Upcoming + in-progress (an event is "past" only once it has ended) */}
                  {events.filter(e => !eventEnded(e, now)).length > 0 && (
                    <div className="space-y-3">
                      {events.filter(e => !eventEnded(e, now)).map(event => (
                        <EventCard
                          key={event.id}
                          event={event}
                          communityId={community.id}
                          myRsvp={myRsvpMap[event.id] ?? null}
                          counts={rsvpCountMap[event.id] ?? { yes: 0, maybe: 0, no: 0 }}
                          canDelete={event.created_by === user!.id || isMod}
                          viewerTz={viewerTz}
                          ongoing={new Date(event.starts_at) <= now}
                        />
                      ))}
                    </div>
                  )}

                  {/* Past */}
                  {events.filter(e => eventEnded(e, now)).length > 0 && (
                    <details className="mt-4">
                      <summary className="text-xs font-medium text-stone-400 uppercase tracking-wide cursor-pointer hover:text-stone-600 select-none">
                        Past events ({events.filter(e => eventEnded(e, now)).length})
                      </summary>
                      <div className="space-y-3 mt-3">
                        {events.filter(e => eventEnded(e, now)).reverse().map(event => (
                          <EventCard
                            key={event.id}
                            event={event}
                            communityId={community.id}
                            myRsvp={myRsvpMap[event.id] ?? null}
                            counts={rsvpCountMap[event.id] ?? { yes: 0, maybe: 0, no: 0 }}
                            canDelete={event.created_by === user!.id || isMod}
                            viewerTz={viewerTz}
                            past
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>
          )}

          {/* Q&A (knowledge base) tab */}
          {tab === 'qa' && (
            <div className="space-y-5">
              {qotwSpotlight && (
                <Link
                  href={`/communities/${slug}/questions/${qotwSpotlight.id}`}
                  className="block rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5 hover:border-orange-300 transition-colors"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">⭐ Question of the Week</p>
                  <h3 className="mt-1 text-lg font-semibold text-stone-900">{qotwSpotlight.title}</h3>
                  {qotwSpotlight.body && <p className="mt-1 text-sm text-stone-600 line-clamp-2">{qotwSpotlight.body}</p>}
                  <p className="mt-3 text-sm font-medium text-orange-600">
                    {qotwSpotlight.answer_count} {qotwSpotlight.answer_count === 1 ? 'answer' : 'answers'} · Add yours →
                  </p>
                </Link>
              )}

              {isMod && kbPending.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                    Questions awaiting review ({kbPending.length})
                  </p>
                  {(kbPending as Array<{ id: string; title: string; body: string | null; created_at: string; profiles: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null }>).map(q => {
                    const author = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles
                    return (
                      <div key={q.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-xs text-stone-400 mb-1">
                          {author?.username ? (
                            <Link href={`/profile/${author.username}`} className="hover:text-orange-600">
                              {author.display_name ?? author.username}
                            </Link>
                          ) : 'Unknown'}
                        </p>
                        <Link href={`/communities/${slug}/questions/${q.id}`} className="font-medium text-stone-900 text-sm hover:text-orange-600">
                          {q.title}
                        </Link>
                        {q.body && <RichContent content={q.body} className="text-stone-600 text-sm mt-1 whitespace-pre-wrap" embeds={false} />}
                        <QuestionModActions questionId={q.id} communityId={community.id} slug={slug} categories={kbCategories} />
                      </div>
                    )
                  })}
                </div>
              )}

              <KnowledgeBoard slug={slug} questions={boardQuestions} categories={kbCategories} />

              <AskQuestionForm communityId={community.id} slug={slug} isMod={isMod} categories={kbCategories} />
            </div>
          )}

          {/* Channels tab */}
          {tab === 'channels' && (
            <div>
              {channels && channels.length > 0 ? (
                <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
                  {channels.map(ch => (
                    <Link
                      key={ch.id}
                      href={`/communities/${slug}/channels/${ch.id}`}
                      className="flex items-center gap-2 px-4 py-3 hover:bg-stone-50 transition-colors"
                    >
                      <span className="text-stone-400 text-sm">#</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800">{ch.name}</p>
                        {ch.description && (
                          <p className="text-xs text-stone-400 truncate">{ch.description}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-400 text-sm">
                  No channels yet.{isMod ? ' Create one in community settings.' : ''}
                </div>
              )}
            </div>
          )}

          {/* Reviews tab */}
          {tab === 'reviews' && (
            <div className="space-y-5">
              {isMod && (
                <p className="text-xs text-stone-400">
                  Approve, reply to, and feature reviews from{' '}
                  <Link href={`/communities/${slug}/settings`} className="text-orange-600 hover:underline">community settings</Link>.
                </p>
              )}

              {publishedReviews.length > 0 ? (
                <ReviewList reviews={publishedReviews} viewerIsStaff={isMod} viewerUsername={myUsername} />
              ) : (
                <p className="text-sm text-stone-400">No reviews yet. Be the first to share your experience.</p>
              )}

              {isMember && (
                <ReviewForm
                  communityId={community.id}
                  slug={slug}
                  isMod={isMod}
                  scopeLabel={community.name}
                  existing={myReview}
                />
              )}
            </div>
          )}
          </div>

          {/* Members sidebar */}
          {members && (
            <aside className="lg:sticky lg:top-8">
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Members ({members.length})
              </h2>
              <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                {members.map((m) => {
                  const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                  if (!profile) return null
                  return (
                    <div key={m.user_id} className="flex items-center justify-between px-4 py-3">
                      <Link href={`/profile/${profile.username}`} className="text-sm font-medium text-stone-800 hover:text-orange-600">
                        {profile.display_name ?? profile.username}
                      </Link>
                      <span className="text-xs text-stone-400 capitalize">{m.role}</span>
                    </div>
                  )
                })}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

type Event = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location_type: string
  location_online: string | null
  location_address: string | null
  created_by: string
  photos: string[] | null
  series_id: string | null
  recurrence: string | null
}

// An event is "past" only once it has ended. If it has no end time, fall back
// to its start time. So an in-progress event (started, not yet ended) is NOT past.
function eventEnded(e: Event, now: Date): boolean {
  return new Date(e.ends_at ?? e.starts_at) < now
}

function recurrenceLabel(recurrence: string): string {
  return recurrence === 'biweekly' ? 'every 2 weeks' : recurrence === 'monthly' ? 'monthly' : 'weekly'
}

function EventCard({
  event,
  communityId,
  myRsvp,
  counts,
  canDelete,
  viewerTz,
  past = false,
  ongoing = false,
}: {
  event: Event
  communityId: string
  myRsvp: string | null
  counts: { yes: number; maybe: number; no: number }
  canDelete: boolean
  viewerTz: string
  past?: boolean
  ongoing?: boolean
}) {
  const dateStr = formatEventDate(event.starts_at, viewerTz)
  const timeStr = formatEventTime(event.starts_at, viewerTz)
  const endTimeStr = event.ends_at ? formatEventTime(event.ends_at, viewerTz) : null
  const zoneLabel = tzAbbrev(event.starts_at, viewerTz)

  return (
    <div className={`bg-white border rounded-xl p-4 ${past ? 'border-stone-100 opacity-70' : ongoing ? 'border-green-300' : 'border-stone-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-stone-900">
              {ongoing && (
                <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 align-middle">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Happening now
                </span>
              )}
              {event.title}
            </h3>
            {canDelete && (
              <EventDeleteControl
                eventId={event.id}
                communityId={communityId}
                isSeries={!!event.series_id}
              />
            )}
          </div>
          <p className="text-sm text-stone-500 mt-0.5">
            {dateStr} · {timeStr}{endTimeStr ? ` – ${endTimeStr}` : ''} {zoneLabel}
          </p>
          {event.recurrence && (
            <p className="text-xs text-stone-400 mt-0.5">🔁 Repeats {recurrenceLabel(event.recurrence)}</p>
          )}

          {event.location_type === 'online' && event.location_online && (
            <a
              href={event.location_online}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-600 hover:underline mt-1 block"
            >
              🔗 Join online
            </a>
          )}
          {event.location_type === 'online' && !event.location_online && (
            <p className="text-xs text-stone-400 mt-1">Online</p>
          )}
          {(event.location_type === 'in_person' || event.location_type === 'hybrid') && event.location_address && (
            <p className="text-xs text-stone-500 mt-1">📍 {event.location_address}</p>
          )}
          {event.location_type === 'hybrid' && event.location_online && (
            <a
              href={event.location_online}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-600 hover:underline mt-0.5 block"
            >
              🔗 Also online
            </a>
          )}

          {event.description && (
            <RichContent content={event.description} className="text-sm text-stone-600 mt-2 whitespace-pre-wrap" />
          )}
          <PhotoGallery photos={event.photos ?? []} />

          <div className="flex items-center gap-3 mt-3 text-xs text-stone-400">
            {counts.yes > 0 && <span>{counts.yes} going</span>}
            {counts.maybe > 0 && <span>{counts.maybe} maybe</span>}
          </div>
        </div>
      </div>

      {!past && (
        <div className="mt-3">
          <RsvpButton eventId={event.id} communityId={communityId} currentStatus={myRsvp} />
        </div>
      )}
    </div>
  )
}
