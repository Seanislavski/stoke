import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import JoinButton from '@/components/community/JoinButton'

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

  // active members (only visible to members + owner)
  const { data: members } = (isMember || isOwner)
    ? await supabase
        .from('community_members')
        .select('user_id, role, profiles(username, display_name, avatar_url)')
        .eq('community_id', community.id)
        .eq('status', 'active')
        .order('role')
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

      {/* Bulletin Board stub */}
      {(isMember || isOwner) && (
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Bulletin Board
          </h2>
          <div className="bg-white rounded-xl border border-stone-200 p-6 text-center text-stone-400 text-sm">
            No posts yet. Bulletin board coming soon.
          </div>
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
