import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import RichContent from '@/components/RichContent'
import LocalDate from '@/components/LocalDate'
import ScrollToHash from '@/components/ScrollToHash'
import DeleteItemButton from '@/components/DeleteItemButton'
import QueueActions from '@/components/community/QueueActions'
import MeTooButton from '@/components/stories/MeTooButton'
import StoryReplyForm from '@/components/stories/StoryReplyForm'
import FollowButton from '@/components/FollowButton'
import { isFollowing } from '@/lib/follows'
import { approveStory, rejectStory, deleteStory, deleteStoryReply } from '@/app/actions/stories'
import { storyByline, replyByline, type Byline } from '@/lib/stories'

type Profile = { id: string; username: string; display_name: string | null }

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string; storyId: string }>
}) {
  const { slug, storyId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, owner_id')
    .eq('slug', slug)
    .single()
  if (!community) notFound()

  const admin = createAdminClient()
  const [{ data: membership }, { data: platformRole }, { data: story }] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', community.id).eq('user_id', user.id).maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
    admin.from('stories')
      .select('id, title, body, is_anonymous, status, author_id, attribution, created_at, published_at')
      .eq('id', storyId).eq('community_id', community.id).maybeSingle(),
  ])
  if (!story) notFound()

  const isActive = membership?.status === 'active'
  const isMod = !!platformRole || user.id === community.owner_id ||
    (isActive && ['organizer', 'moderator'].includes(membership?.role ?? ''))
  const isMember = isActive || isMod
  const isAuthor = story.author_id === user.id

  // Stories are members-only. A non-member who follows a link gets told what this
  // is and how to get in — but not the title, which can be as personal as the story.
  if (!isMember) {
    if (story.status !== 'published') notFound()
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center space-y-3">
          <p className="text-3xl">📖</p>
          <h1 className="text-lg font-semibold text-stone-900">This story is shared with members of {community.name}</h1>
          <p className="text-sm text-stone-500">
            Stories are personal, so only members can read them. Join the community to read this one and share your own.
          </p>
          <Link
            href={`/communities/${slug}`}
            className="inline-block mt-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Go to {community.name}
          </Link>
        </div>
      </div>
    )
  }

  // Unpublished stories are visible only to their author and to mods.
  if (story.status !== 'published' && !isMod && !isAuthor) notFound()

  const [{ data: replyRows }, { data: mine }, metooCount, following] = await Promise.all([
    story.status === 'published'
      ? admin.from('story_replies').select('id, body, author_id, created_at').eq('story_id', story.id).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; body: string; author_id: string; created_at: string }[] }),
    admin.from('story_metoo').select('story_id').eq('story_id', story.id).eq('user_id', user.id).maybeSingle(),
    // Only the author is ever told the count.
    isAuthor
      ? admin.from('story_metoo').select('*', { count: 'exact', head: true }).eq('story_id', story.id).then(r => r.count ?? 0)
      : Promise.resolve(0),
    // The author always hears about replies, so they get no follow button.
    story.status === 'published' && !isAuthor ? isFollowing(user.id, { kind: 'story', id: story.id }) : Promise.resolve(false),
  ])
  const replies = replyRows ?? []

  const profileIds = [...new Set([story.author_id, ...replies.map(r => r.author_id)])]
  const { data: profileRows } = await admin.from('profiles').select('id, username, display_name').in('id', profileIds)
  const profileById = new Map((profileRows ?? []).map((p: Profile) => [p.id, p]))

  const viewer = { id: user.id, isMod }
  const byline = storyByline(story, profileById.get(story.author_id) ?? null, viewer)

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Audit-log links land on #reply-{id}; hashes don't scroll on first load otherwise. */}
      <ScrollToHash />
      <Link href={`/communities/${slug}?tab=stories`} className="text-sm text-stone-400 hover:text-stone-700">
        ← Stories in {community.name}
      </Link>

      {story.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          {isMod ? 'This story is waiting for review.' : 'Thank you for sharing. A moderator will read your story and publish it soon — until then only you and the moderators can see it.'}
          {isMod && (
            <QueueActions
              approve={approveStory.bind(null, story.id, community.id, slug)}
              reject={rejectStory.bind(null, story.id, community.id, slug)}
              approveLabel="Publish"
            />
          )}
        </div>
      )}
      {story.status === 'rejected' && (
        <div className="bg-stone-100 border border-stone-200 rounded-xl p-4 text-sm text-stone-600">
          This story wasn&apos;t published. Only you and the moderators can see it.
        </div>
      )}

      <article className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">{story.title}</h1>
          <p className="text-xs text-stone-400 mt-1">
            <BylineText byline={byline} /> · <LocalDate ts={story.published_at ?? story.created_at} dateOnly />
          </p>
        </div>
        <RichContent content={story.body} embeds={false} className="text-[15px] leading-relaxed text-stone-700 break-words whitespace-pre-wrap" />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100">
          {story.status === 'published' && !isAuthor ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <MeTooButton storyId={story.id} communityId={community.id} slug={slug} initialOn={!!mine} />
              <FollowButton kind="story" targetId={story.id} communityId={community.id} initialOn={following} />
            </span>
          ) : story.status === 'published' && isAuthor ? (
            <p className="text-sm text-stone-500">
              💛 {metooCount === 0
                ? 'No one has said "me too" yet.'
                : `${metooCount} ${metooCount === 1 ? 'person' : 'people'} said "me too".`}
              <span className="block text-xs text-stone-400">Only you can see this.</span>
              <span className="block text-xs text-stone-400 mt-1">🔔 You&apos;ll be notified of every reply.</span>
            </p>
          ) : <span />}
          {(isAuthor || isMod) && (
            <DeleteItemButton
              action={deleteStory.bind(null, story.id, community.id, slug)}
              confirm={isAuthor ? 'Delete your story? Its replies will be deleted too. This can’t be undone.' : 'Delete this story and its replies? This can’t be undone.'}
              label="Delete story"
              redirectTo={`/communities/${slug}?tab=stories`}
              className="text-xs text-stone-400 hover:text-red-600"
            />
          )}
        </div>
      </article>

      {story.status === 'published' && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
            Replies {replies.length > 0 && <span className="text-orange-600">({replies.length})</span>}
          </h2>
          {replies.length === 0 && (
            <p className="text-sm text-stone-400">No replies yet. A few kind words go a long way.</p>
          )}
          {replies.map(r => {
            const rb = replyByline(r, profileById.get(r.author_id) ?? null, story, viewer)
            return (
              <div key={r.id} id={`reply-${r.id}`} className="bg-white border border-stone-200 rounded-xl p-4 scroll-mt-20">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-stone-400">
                    <BylineText byline={rb} /> · <LocalDate ts={r.created_at} />
                  </p>
                  {(r.author_id === user.id || isMod) && (
                    <DeleteItemButton
                      action={deleteStoryReply.bind(null, r.id, community.id, slug)}
                      confirm="Delete this reply?"
                      className="text-xs text-stone-400 hover:text-red-600"
                    />
                  )}
                </div>
                <RichContent content={r.body} embeds={false} className="text-sm text-stone-700 mt-1 break-words whitespace-pre-wrap" />
              </div>
            )
          })}
          <StoryReplyForm storyId={story.id} communityId={community.id} slug={slug} />
        </section>
      )}
    </div>
  )
}

function BylineText({ byline }: { byline: Byline }) {
  return byline.link
    ? <Link href={byline.link} className="font-medium text-stone-600 hover:text-orange-600">{byline.label}</Link>
    : <span className="font-medium text-stone-600">{byline.label}</span>
}
