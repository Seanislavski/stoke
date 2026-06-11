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
import DeleteItemButton from '@/components/DeleteItemButton'
import RichContent from '@/components/RichContent'
import PhotoGallery from '@/components/PhotoGallery'
import { deletePost } from '@/app/actions/bulletin'
import { deleteEvent } from '@/app/actions/events'
import AskQuestionForm from '@/components/knowledge/AskQuestionForm'
import KnowledgeBoard, { type BoardQuestion } from '@/components/knowledge/KnowledgeBoard'
import QuestionModActions from '@/components/knowledge/QuestionModActions'
import OnboardingChecklist from '@/components/community/OnboardingChecklist'

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
  ])

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

  // Events tab data
  let events: Event[] | null = null
  let rsvpCountMap: Record<string, { yes: number; maybe: number; no: number }> = {}
  let myRsvpMap: Record<string, string> = {}

  if (tab === 'events' && canSee) {
    const { data: eventsData } = await admin
      .from('events')
      .select('id, title, description, starts_at, ends_at, location_type, location_online, location_address, created_by, photos')
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
  ]

  const now = new Date()

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">

      {/* Header */}
      <div className="relative bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-start justify-between gap-4">
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
            />
            {isMod && (
              <CommunityGear
                slug={slug}
                pendingCount={pendingCount ?? 0}
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
          <div className="flex border-b border-stone-200 mb-6">
            {TABS.map(t => (
              <Link
                key={t.key}
                href={`/communities/${slug}?tab=${t.key}`}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
                  {/* Upcoming */}
                  {events.filter(e => new Date(e.starts_at) >= now).length > 0 && (
                    <div className="space-y-3">
                      {events.filter(e => new Date(e.starts_at) >= now).map(event => (
                        <EventCard
                          key={event.id}
                          event={event}
                          communityId={community.id}
                          myRsvp={myRsvpMap[event.id] ?? null}
                          counts={rsvpCountMap[event.id] ?? { yes: 0, maybe: 0, no: 0 }}
                          canDelete={event.created_by === user!.id || isMod}
                        />
                      ))}
                    </div>
                  )}

                  {/* Past */}
                  {events.filter(e => new Date(e.starts_at) < now).length > 0 && (
                    <details className="mt-4">
                      <summary className="text-xs font-medium text-stone-400 uppercase tracking-wide cursor-pointer hover:text-stone-600 select-none">
                        Past events ({events.filter(e => new Date(e.starts_at) < now).length})
                      </summary>
                      <div className="space-y-3 mt-3">
                        {events.filter(e => new Date(e.starts_at) < now).reverse().map(event => (
                          <EventCard
                            key={event.id}
                            event={event}
                            communityId={community.id}
                            myRsvp={myRsvpMap[event.id] ?? null}
                            counts={rsvpCountMap[event.id] ?? { yes: 0, maybe: 0, no: 0 }}
                            canDelete={event.created_by === user!.id || isMod}
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
}

function EventCard({
  event,
  communityId,
  myRsvp,
  counts,
  canDelete,
  past = false,
}: {
  event: Event
  communityId: string
  myRsvp: string | null
  counts: { yes: number; maybe: number; no: number }
  canDelete: boolean
  past?: boolean
}) {
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null

  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endTimeStr = end?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className={`bg-white border rounded-xl p-4 ${past ? 'border-stone-100 opacity-70' : 'border-stone-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-stone-900">{event.title}</h3>
            {canDelete && (
              <DeleteItemButton
                action={deleteEvent.bind(null, event.id, communityId)}
                confirm="Delete this event?"
              />
            )}
          </div>
          <p className="text-sm text-stone-500 mt-0.5">
            {dateStr} · {timeStr}{endTimeStr ? ` – ${endTimeStr}` : ''}
          </p>

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
