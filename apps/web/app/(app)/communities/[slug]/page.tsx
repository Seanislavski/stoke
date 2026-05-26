import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import JoinButton from '@/components/community/JoinButton'
import SubmitPostForm from '@/components/bulletin/SubmitPostForm'
import ModActions from '@/components/bulletin/ModActions'

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, description, join_mode, is_listed, owner_id, category_id')
    .eq('slug', slug)
    .single()

  if (!community) notFound()

  const isOwner = user?.id === community.owner_id

  // current user's membership
  const { data: myMembership } = await supabase
    .from('community_members')
    .select('role, status')
    .eq('community_id', community.id)
    .eq('user_id', user!.id)
    .maybeSingle()

  const isMember = myMembership?.status === 'active'
  const isMod = ['organizer', 'moderator'].includes(myMembership?.role ?? '')
  const canSee = isMember || isOwner

  const admin = createAdminClient()

  // active members
  const { data: members } = canSee
    ? await admin
        .from('community_members')
        .select('user_id, role, profiles(username, display_name, avatar_url)')
        .eq('community_id', community.id)
        .eq('status', 'active')
        .order('role')
    : { data: null }

  // published bulletin posts (all members)
  const { data: publishedPosts } = canSee
    ? await admin
        .from('bulletin_posts')
        .select('id, title, content, published_at, profiles(username, display_name)')
        .eq('community_id', community.id)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
    : { data: null }

  // pending posts (mods/organizers only)
  const { data: pendingPosts } = (isMod || isOwner)
    ? await admin
        .from('bulletin_posts')
        .select('id, title, content, created_at, profiles(username, display_name)')
        .eq('community_id', community.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    : { data: null }

  const joinModeLabel: Record<string, string> = {
    open: 'Open',
    request: 'Request to join',
    invite_only: 'Invite only',
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-8">

      {/* Header */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
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
          <div className="shrink-0">
            <JoinButton
              communityId={community.id}
              joinMode={community.join_mode}
              slug={community.slug}
              memberStatus={myMembership?.status ?? null}
              isOwner={isOwner}
            />
          </div>
        </div>

        {isOwner && (
          <div className="mt-4 pt-4 border-t border-stone-100">
            <Link
              href={`/communities/${slug}/settings`}
              className="text-sm text-stone-400 hover:text-stone-700"
            >
              Community settings →
            </Link>
          </div>
        )}
      </div>

      {/* Gate: non-members see limited view */}
      {!isMember && !isOwner && (
        <div className="bg-stone-100 rounded-xl p-6 text-center text-stone-500 text-sm">
          Join this community to see the bulletin board, channels, and members.
        </div>
      )}

      {/* Members */}
      {(isMember || isOwner) && members && (
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
                  <span className="text-sm font-medium text-stone-800">
                    {profile.display_name ?? profile.username}
                  </span>
                  <span className="text-xs text-stone-400 capitalize">{m.role}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Bulletin Board */}
      {canSee && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
              Bulletin Board
            </h2>
          </div>

          {/* Pending posts — mods only */}
          {(isMod || isOwner) && pendingPosts && pendingPosts.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                Awaiting review ({pendingPosts.length})
              </p>
              {pendingPosts.map(post => {
                const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
                return (
                  <div key={post.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs text-stone-400 mb-1">
                      {author?.display_name ?? author?.username ?? 'Unknown'}
                    </p>
                    <h3 className="font-medium text-stone-900 text-sm">{post.title}</h3>
                    <p className="text-stone-600 text-sm mt-1 whitespace-pre-wrap">{post.content}</p>
                    <ModActions postId={post.id} communityId={community.id} slug={community.slug} />
                  </div>
                )
              })}
            </div>
          )}

          {/* Published posts */}
          {publishedPosts && publishedPosts.length > 0 ? (
            <div className="space-y-3">
              {publishedPosts.map(post => {
                const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
                const date = post.published_at
                  ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : ''
                return (
                  <div key={post.id} className="bg-white border border-stone-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs text-stone-400 mb-2">
                      <span>{author?.display_name ?? author?.username ?? 'Unknown'}</span>
                      {date && <><span>·</span><span>{date}</span></>}
                    </div>
                    <h3 className="font-semibold text-stone-900">{post.title}</h3>
                    <p className="text-stone-600 text-sm mt-1 whitespace-pre-wrap">{post.content}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
              No posts yet.
            </div>
          )}

          <SubmitPostForm communityId={community.id} slug={community.slug} isMod={isMod || isOwner} />
        </section>
      )}

      {/* Channels stub */}
      {(isMember || isOwner) && (
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Gathering Spaces
          </h2>
          <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-400 text-sm">
            No channels yet. Text channels coming soon.
          </div>
        </section>
      )}

    </div>
  )
}
