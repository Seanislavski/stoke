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
import CommunityPhotoWall from '@/components/community/CommunityPhotoWall'
import { deletePost } from '@/app/actions/bulletin'
import AskQuestionForm from '@/components/knowledge/AskQuestionForm'
import KnowledgeBoard, { type BoardQuestion } from '@/components/knowledge/KnowledgeBoard'
import { findQotwCategoryId } from '@/lib/qotw'
import QuestionModActions from '@/components/knowledge/QuestionModActions'
import ReviewForm from '@/components/reviews/ReviewForm'
import ReviewList from '@/components/reviews/ReviewList'
import { REVIEW_COLS, mapReview, type RawReview } from '@/lib/reviews'
import OnboardingChecklist from '@/components/community/OnboardingChecklist'
import LocalDate from '@/components/LocalDate'
import { CONTEST_STATUS_LABELS, type ContestStatus } from '@/lib/contests'
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
    .select('id, name, slug, description, about, join_mode, is_listed, owner_id, category_id, image_url, banner_url, photos, has_contests, show_discord_handles')
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

  // Handles are only QUERIED when this community shows them — the same rule as
  // contest vote counts. Fetching then hiding would still put them in reach.
  const memberSelect = community.show_discord_handles
    ? 'user_id, role, profiles(username, display_name, avatar_url, discord_username, show_discord)'
    : 'user_id, role, profiles(username, display_name, avatar_url)'

  // Always fetch: members (for count + list), pending/banned counts for gear
  const [
    { data: members },
    { count: pendingCount },
    { count: bannedCount },
    { count: pendingReviewsCount },
    { count: pendingPostsCount },
    { count: pendingQuestionsCount },
    { count: pendingAnswersCount },
    { count: pendingCapturesCount },
    { count: pendingTestimonialsCount },
  ] = await Promise.all([
    canSee
      ? admin.from('community_members')
          .select(memberSelect)
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
    // ⚠️ These two counts must mirror the queries on the pages they link to,
    // or the badge points somewhere empty. `kind` splits them: 'qa' captures go
    // to the review queue, 'testimonial' ones to the testimonials page.
    isMod
      ? admin.from('discord_captures')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('kind', 'qa')
          .in('consent_status', ['granted_credited', 'granted_anon'])
          .is('question_id', null).is('answer_id', null).is('dismissed_at', null)
      : Promise.resolve({ count: 0 }),
    isMod
      ? admin.from('discord_captures')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('kind', 'testimonial')
          .in('consent_status', ['granted_credited', 'granted_anon'])
          .is('review_id', null).is('dismissed_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  // Total items waiting on a mod — drives the gear badge. Each contributing
  // count belongs to exactly one destination in the gear menu.
  const totalPending = (pendingCount ?? 0) + (pendingReviewsCount ?? 0) + (pendingPostsCount ?? 0) + (pendingQuestionsCount ?? 0) + (pendingAnswersCount ?? 0) + (pendingCapturesCount ?? 0)
  const reviewQueueCount = totalPending
  const gearBadgeCount = totalPending + (pendingTestimonialsCount ?? 0)

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

  // Photos tab — organizer/moderator aggregate of every inline image across the
  // community (bulletin, events, Q&A + captured Discord photos, channel chats).
  // Mod-only because some sources (role-gated channel chats) aren't visible to
  // every member; regular members only ever see the curated gallery.
  type WallPhoto = { url: string; href: string; source: string; at: string }
  let photoWall: WallPhoto[] = []
  if (tab === 'photos' && isMod) {
    const communityChannels = await admin.from('channels').select('id').eq('community_id', community.id).then(r => r.data ?? [])
    const channelIds = communityChannels.map((c: { id: string }) => c.id)
    const [bposts, evs, kbq, kba, msgs] = await Promise.all([
      admin.from('bulletin_posts').select('id, photos, created_at').eq('community_id', community.id).eq('status', 'published').then(r => r.data ?? []),
      admin.from('events').select('id, photos, starts_at').eq('community_id', community.id).then(r => r.data ?? []),
      admin.from('kb_questions').select('id, photos, published_at, created_at').eq('community_id', community.id).eq('status', 'published').then(r => r.data ?? []),
      admin.from('kb_answers').select('id, question_id, photos, published_at, created_at').eq('community_id', community.id).eq('status', 'published').then(r => r.data ?? []),
      channelIds.length
        ? admin.from('messages').select('id, image_url, photos, channel_id, created_at').in('channel_id', channelIds).is('deleted_at', null).or('image_url.not.is.null,photos.neq.{}').then(r => r.data ?? [])
        : Promise.resolve([]),
    ])
    const push = (photos: string[] | null, href: string, source: string, at: string) => {
      for (const url of photos ?? []) if (url) photoWall.push({ url, href, source, at })
    }
    for (const p of bposts) push(p.photos, `/communities/${slug}?tab=bulletin`, 'Bulletin', p.created_at)
    for (const e of evs) push(e.photos, `/communities/${slug}?tab=events`, 'Event', e.starts_at)
    for (const q of kbq) push(q.photos, `/communities/${slug}/questions/${q.id}`, 'Q&A', q.published_at ?? q.created_at)
    for (const a of kba) push(a.photos, `/communities/${slug}/questions/${a.question_id}#answer-${a.id}`, 'Q&A answer', a.published_at ?? a.created_at)
    // Chat: read both the legacy single image_url and the future photos[] array.
    for (const m of msgs) {
      const urls = [...(m.image_url ? [m.image_url] : []), ...(m.photos ?? [])]
      for (const url of urls) photoWall.push({ url, href: `/communities/${slug}/channels/${m.channel_id}?message=${m.id}`, source: 'Chat', at: m.created_at })
    }
    photoWall.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
  }

  // Contests tab data — mods also see drafts, which members shouldn't know exist.
  const contests = (tab === 'contests' && canSee && community.has_contests)
    ? await admin
        .from('contests')
        .select('id, title, description, status, submissions_close_at, winner_entry_id, created_at')
        .eq('community_id', community.id)
        .order('created_at', { ascending: false })
        .then(r => (r.data ?? []).filter(c => isMod || c.status !== 'draft'))
    : []

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
    ...(community.has_contests ? [{ key: 'contests', label: 'Contests' }] : []),
    // Photos: always for mods (they get the full aggregate); for members only
    // once there's a curated gallery to show, so the tab is never empty for them.
    ...(isMod || (community.photos?.length ?? 0) > 0 ? [{ key: 'photos', label: 'Photos' }] : []),
  ]

  const now = new Date()

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">

      {/* Cover image */}
      {community.banner_url && (
        <div className="w-full aspect-[3/1] rounded-xl overflow-hidden border border-stone-200">
          <Image src={community.banner_url} alt={`${community.name} cover`} width={1500} height={500} className="w-full h-full object-cover" priority />
        </div>
      )}

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
                pendingCount={gearBadgeCount}
                reviewQueueCount={reviewQueueCount}
                testimonialCount={pendingTestimonialsCount ?? 0}
              />
            )}
          </div>
        </div>
      </div>

      {/* About this community */}
      {community.about && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">About</h2>
          <RichContent content={community.about} className="text-stone-700 leading-relaxed break-words whitespace-pre-wrap" />
        </div>
      )}

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

          {/* Contests tab */}
          {tab === 'contests' && (
            <div className="space-y-4">
              {isMod && (
                <p className="text-xs text-stone-400">
                  Create and run contests from{' '}
                  <Link href={`/communities/${slug}/settings#contests`} className="text-orange-600 hover:underline">community settings</Link>.
                </p>
              )}

              {contests.length === 0 ? (
                <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-400 text-sm">
                  No contests yet.{isMod ? ' Start one in community settings.' : ''}
                </div>
              ) : (
                <div className="space-y-3">
                  {contests.map(c => (
                    <Link
                      key={c.id}
                      href={`/communities/${slug}/contests/${c.id}`}
                      className="block bg-white rounded-xl border border-stone-200 p-5 hover:border-orange-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <h3 className="text-base font-semibold text-stone-900">{c.title}</h3>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
                          c.status === 'voting' ? 'bg-orange-100 text-orange-700'
                            : c.status === 'submissions' ? 'bg-green-100 text-green-700'
                            : c.status === 'closed' ? 'bg-stone-100 text-stone-500'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {CONTEST_STATUS_LABELS[c.status as ContestStatus]}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-sm text-stone-500 mt-1.5 line-clamp-2">{c.description}</p>
                      )}
                      {c.status === 'submissions' && c.submissions_close_at && (
                        <p className="text-xs text-stone-400 mt-2">
                          Entries close <LocalDate ts={c.submissions_close_at} />
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photos tab — curated gallery for everyone; a full aggregate for mods */}
          {tab === 'photos' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">Community gallery</h2>
                {community.photos && community.photos.length > 0 ? (
                  <PhotoGallery photos={community.photos} />
                ) : (
                  <p className="text-sm text-stone-400">
                    No gallery photos yet.{isMod ? ' Add some in community settings → General.' : ''}
                  </p>
                )}
              </div>

              {isMod && (
                <div>
                  <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-1">
                    All photos{photoWall.length > 0 && <span className="text-stone-400 font-normal normal-case"> · {photoWall.length}</span>}
                  </h2>
                  <p className="text-xs text-stone-400 mb-3">
                    Every image shared in posts, events, Q&amp;A, and chats. Only organizers and moderators see this.
                  </p>
                  {photoWall.length > 0 ? (
                    <CommunityPhotoWall photos={photoWall} />
                  ) : (
                    <p className="text-sm text-stone-400">No photos have been shared in posts, events, Q&amp;A, or chats yet.</p>
                  )}
                </div>
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
                  const profile = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as MemberProfile | undefined
                  if (!profile) return null
                  const discord = profile.show_discord ? profile.discord_username : null
                  return (
                    <div key={m.user_id} className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <Link href={`/profile/${profile.username}`} className="block text-sm font-medium text-stone-800 hover:text-orange-600 truncate">
                          {profile.display_name ?? profile.username}
                        </Link>
                        {discord && (
                          <span className="block text-xs text-stone-400 truncate" title={`Discord: ${discord}`}>
                            {discord}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-stone-400 capitalize shrink-0">{m.role}</span>
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

// The member-list join. discord_username/show_discord are only present when the
// community has handles enabled, hence optional.
type MemberProfile = {
  username: string
  display_name: string | null
  avatar_url: string | null
  discord_username?: string | null
  show_discord?: boolean | null
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
