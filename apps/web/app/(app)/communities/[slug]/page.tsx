import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import JoinButton from '@/components/community/JoinButton'
import CommunityGear from '@/components/community/CommunityGear'
import SubmitPostForm from '@/components/bulletin/SubmitPostForm'
import ModActions from '@/components/bulletin/ModActions'
import CreateEventButton from '@/components/events/CreateEventButton'
import RsvpButton from '@/components/events/RsvpButton'
import SubmitResourceForm from '@/components/resources/SubmitResourceForm'
import ResourceModActions from '@/components/resources/ResourceModActions'
import DeleteItemButton from '@/components/DeleteItemButton'
import RichContent from '@/components/RichContent'
import LinkPreview from '@/components/LinkPreview'
import { deletePost } from '@/app/actions/bulletin'
import { deleteEvent } from '@/app/actions/events'
import { deleteResource } from '@/app/actions/resources'

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
    .select('id, name, slug, description, join_mode, is_listed, owner_id, category_id')
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

  // Bulletin tab data
  const [publishedPosts, pendingPosts] = await Promise.all([
    (tab === 'bulletin' && canSee)
      ? admin.from('bulletin_posts')
          .select('id, title, content, published_at, profiles(username, display_name)')
          .eq('community_id', community.id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .then(r => r.data)
      : Promise.resolve(null),
    (tab === 'bulletin' && isMod)
      ? admin.from('bulletin_posts')
          .select('id, title, content, created_at, profiles(username, display_name)')
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

  // Resources tab data
  const [publishedResources, pendingResources] = await Promise.all([
    (tab === 'resources' && canSee)
      ? admin.from('resources')
          .select('id, title, description, url, resource_type, published_at, profiles(username, display_name)')
          .eq('community_id', community.id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .then(r => r.data)
      : Promise.resolve(null),
    (tab === 'resources' && isMod)
      ? admin.from('resources')
          .select('id, title, description, url, resource_type, created_at, profiles(username, display_name)')
          .eq('community_id', community.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .then(r => r.data)
      : Promise.resolve(null),
  ])

  // Events tab data
  let events: Event[] | null = null
  let rsvpCountMap: Record<string, { yes: number; maybe: number; no: number }> = {}
  let myRsvpMap: Record<string, string> = {}

  if (tab === 'events' && canSee) {
    const { data: eventsData } = await admin
      .from('events')
      .select('id, title, description, starts_at, ends_at, location_type, location_online, location_address, created_by')
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
    { key: 'resources', label: 'Resources' },
    { key: 'channels', label: 'Channels' },
  ]

  const now = new Date()

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">

      {/* Header */}
      <div className="relative bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-start justify-between gap-4">
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

      {/* Gate: non-members */}
      {!canSee && (
        <div className="bg-stone-100 rounded-xl p-6 text-center text-stone-500 text-sm">
          Join this community to see the bulletin board, events, channels, and members.
        </div>
      )}

      {/* Members */}
      {canSee && members && (
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Members ({members.length})
          </h2>
          <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
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
        </section>
      )}

      {/* Tabs */}
      {canSee && (
        <div>
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
                        <RichContent content={post.content} className="text-stone-600 text-sm mt-1 whitespace-pre-wrap" />
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
                        <RichContent content={post.content} className="text-stone-600 text-sm mt-1 whitespace-pre-wrap" />
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

          {/* Resources tab */}
          {tab === 'resources' && (
            <div className="space-y-4">
              {isMod && pendingResources && pendingResources.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                    Awaiting review ({pendingResources.length})
                  </p>
                  {pendingResources.map(resource => {
                    const author = Array.isArray(resource.profiles) ? resource.profiles[0] : resource.profiles
                    return (
                      <div key={resource.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-stone-400 mb-1">
                              {author?.username ? (
                                <Link href={`/profile/${author.username}`} className="hover:text-orange-600">
                                  {author.display_name ?? author.username}
                                </Link>
                              ) : 'Unknown'}
                              {' · '}
                              <span className="capitalize">{resource.resource_type}</span>
                            </p>
                            <h3 className="font-medium text-stone-900 text-sm">{resource.title}</h3>
                            <a href={resource.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-orange-600 hover:underline truncate block mt-0.5">
                              {resource.url}
                            </a>
                            <LinkPreview url={resource.url} />
                            {resource.description && (
                              <RichContent content={resource.description} className="text-stone-600 text-sm mt-1" embeds={false} />
                            )}
                          </div>
                        </div>
                        <ResourceModActions resourceId={resource.id} communityId={community.id} slug={community.slug} />
                      </div>
                    )
                  })}
                </div>
              )}

              {publishedResources && publishedResources.length > 0 ? (
                <div className="space-y-3">
                  {publishedResources.map(resource => {
                    const author = Array.isArray(resource.profiles) ? resource.profiles[0] : resource.profiles
                    const date = resource.published_at
                      ? new Date(resource.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : ''
                    return (
                      <div key={resource.id} className="bg-white border border-stone-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-stone-400 mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="capitalize bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">
                                  {resource.resource_type}
                                </span>
                                {author?.username && (
                                  <Link href={`/profile/${author.username}`} className="hover:text-orange-600">
                                    {author.display_name ?? author.username}
                                  </Link>
                                )}
                                {date && <span>{date}</span>}
                              </div>
                              {isMod && (
                                <DeleteItemButton
                                  action={deleteResource.bind(null, resource.id, community.id, slug)}
                                  confirm="Delete this resource?"
                                />
                              )}
                            </div>
                            <h3 className="font-semibold text-stone-900">{resource.title}</h3>
                            <a href={resource.url} target="_blank" rel="noopener noreferrer"
                              className="text-sm text-orange-600 hover:underline break-all">
                              {resource.url}
                            </a>
                            <LinkPreview url={resource.url} />
                            {resource.description && (
                              <RichContent content={resource.description} className="text-stone-600 text-sm mt-1" embeds={false} />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
                  No resources yet.
                </div>
              )}

              <SubmitResourceForm communityId={community.id} slug={community.slug} isMod={isMod} />
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
