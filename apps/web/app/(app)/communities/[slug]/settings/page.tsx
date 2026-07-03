import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import CommunityInfoForm from '@/components/community/settings/CommunityInfoForm'
import MembersManager from '@/components/community/settings/MembersManager'
import TransferOwnershipSection from '@/components/community/settings/TransferOwnershipSection'
import ChannelManager from '@/components/community/settings/ChannelManager'
import InviteManager from '@/components/community/settings/InviteManager'
import CategoryManager from '@/components/knowledge/CategoryManager'
import ReviewsManager from '@/components/reviews/ReviewsManager'
import { REVIEW_COLS, mapReview, type RawReview } from '@/lib/reviews'
import { ACTION_LABELS } from '@/lib/audit'
import LocalDate from '@/components/LocalDate'
import EmailBlastForm from '@/components/community/settings/EmailBlastForm'

export default async function CommunitySettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, description, join_mode, is_listed, category_id, owner_id, image_url')
    .eq('slug', slug)
    .single()

  if (!community) notFound()

  const isOwner = user.id === community.owner_id
  const admin = createAdminClient()

  // Determine caller's role
  let callerRole: 'owner' | 'organizer' | 'moderator' | null = isOwner ? 'owner' : null
  if (!callerRole) {
    const { data: membership } = await admin
      .from('community_members')
      .select('role')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (membership?.role === 'organizer') callerRole = 'organizer'
    else if (membership?.role === 'moderator') callerRole = 'moderator'
  }

  if (!callerRole) redirect(`/communities/${slug}`)

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  const baseUrl = `${proto}://${host}`

  const [{ data: categories }, { data: members }, { data: channels }, { data: invites }, { data: auditLog }, { data: lastBlast }, { data: kbCategories }] = await Promise.all([
    supabase.from('categories').select('id, name').order('name'),
    admin
      .from('community_members')
      .select('user_id, role, status, profiles(username, display_name)')
      .eq('community_id', community.id)
      .in('status', ['active', 'pending', 'banned'])
      .order('role'),
    admin
      .from('channels')
      .select('id, name, description')
      .eq('community_id', community.id)
      .order('position')
      .order('created_at'),
    admin
      .from('invites')
      .select('id, token, max_uses, use_count, expires_at, created_at')
      .eq('community_id', community.id)
      .order('created_at', { ascending: false }),
    admin
      .from('audit_log')
      .select('id, created_at, action, target_user_id, target_id, target_type, metadata, actor:actor_id(username, display_name), target_user:target_user_id(username, display_name)')
      .eq('community_id', community.id)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('email_blasts')
      .select('created_at')
      .eq('community_id', community.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('kb_categories')
      .select('id, name, description')
      .eq('community_id', community.id)
      .order('position'),
  ])

  const { data: reviewsRaw } = await admin
    .from('reviews')
    .select(REVIEW_COLS)
    .eq('community_id', community.id)
    .order('created_at', { ascending: false })
  const reviewItems = ((reviewsRaw ?? []) as RawReview[]).map(mapReview)

  const normalizedMembers = (members ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
  }))

  const memberIds = normalizedMembers.map(m => m.user_id)
  const { data: platformRoleRows } = memberIds.length
    ? await admin.from('platform_roles').select('user_id, role').in('user_id', memberIds).in('role', ['owner', 'platform_moderator'])
    : { data: [] }
  const platformStaffIds = new Set((platformRoleRows ?? []).map(r => r.user_id))

  // Eligible transfer recipients: active organizers other than the current owner.
  const eligibleOrganizers = normalizedMembers
    .filter(m => m.status === 'active' && m.role === 'organizer' && m.user_id !== community.owner_id && m.profiles)
    .map(m => ({ user_id: m.user_id, username: m.profiles!.username, display_name: m.profiles!.display_name }))

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-10">
      <div className="flex items-center gap-3">
        <Link href={`/communities/${slug}`} className="text-sm text-stone-400 hover:text-stone-700">
          ← {community.name}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-stone-900">Community settings</h1>
        <p className="mt-1 text-sm text-stone-500 capitalize">Your role: {callerRole}</p>
      </div>

      {/* General info */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-4">General</h2>
        <CommunityInfoForm
          community={community}
          categories={categories ?? []}
        />
      </section>

      <hr className="border-stone-200" />

      {/* Channels */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-4">Gathering Spaces</h2>
        <ChannelManager
          communityId={community.id}
          slug={slug}
          initialChannels={channels ?? []}
        />
      </section>

      <hr className="border-stone-200" />

      {/* Q&A categories */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-1">Q&amp;A categories</h2>
        <p className="text-sm text-stone-500 mb-4">Topics members can browse and filter approved questions by. You assign a category when you approve a question.</p>
        <CategoryManager
          communityId={community.id}
          slug={slug}
          initialCategories={kbCategories ?? []}
        />
      </section>

      <hr className="border-stone-200" />

      {/* Question of the Week */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-1">Question of the Week</h2>
        <p className="text-sm text-stone-500 mb-4">Stockpile questions ahead of time and publish one whenever you&apos;re ready. Each gets a permanent, deadline-free link to share.</p>
        <Link
          href={`/communities/${slug}/qotw`}
          className="inline-block text-sm bg-stone-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-stone-900"
        >
          Manage Question of the Week →
        </Link>
      </section>

      <hr className="border-stone-200" />

      {/* Reviews */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-1">Reviews</h2>
        <p className="text-sm text-stone-500 mb-4">Approve member reviews, reply to them, and feature up to 6 as public testimonials on your community&apos;s preview page.</p>
        <ReviewsManager
          communityId={community.id}
          slug={slug}
          initialReviews={reviewItems}
        />
      </section>

      <hr className="border-stone-200" />

      {/* Invites */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-1">Invite links</h2>
        <p className="text-sm text-stone-500 mb-4">Share a link to bring people to this community. They'll join the approval queue even if the community is invite-only.</p>
        <InviteManager
          communityId={community.id}
          slug={slug}
          baseUrl={baseUrl}
          initialInvites={invites ?? []}
        />
      </section>

      <hr className="border-stone-200" />

      {/* Members */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-4">Members</h2>
        <MembersManager
          communityId={community.id}
          slug={slug}
          callerRole={callerRole}
          callerId={user.id}
          initialMembers={normalizedMembers as Parameters<typeof MembersManager>[0]['initialMembers']}
          platformStaffIds={[...platformStaffIds]}
        />
      </section>

      <hr className="border-stone-200" />

      {/* Email blast — organizers only */}
      {(callerRole === 'organizer' || callerRole === 'owner') && (
        <section>
          <h2 className="text-base font-semibold text-stone-800">Email members</h2>
          <EmailBlastForm
            communityId={community.id}
            memberCount={normalizedMembers.filter(m => m.status === 'active').length}
            lastBlastAt={lastBlast?.created_at ?? null}
          />
        </section>
      )}

      {/* Transfer ownership — real community owner only */}
      {isOwner && (
        <>
          <hr className="border-stone-200" />
          <section>
            <h2 className="text-base font-semibold text-stone-800 mb-4">Danger zone</h2>
            <TransferOwnershipSection
              communityId={community.id}
              slug={slug}
              communityName={community.name}
              organizers={eligibleOrganizers}
            />
          </section>
        </>
      )}

      <hr className="border-stone-200" />

      {/* Audit log */}
      <section className="pb-8">
        <h2 className="text-base font-semibold text-stone-800 mb-1">Audit log</h2>
        <p className="text-sm text-stone-500 mb-4">Recent moderation actions in this community.</p>
        {!auditLog || auditLog.length === 0 ? (
          <p className="text-sm text-stone-400">No actions logged yet.</p>
        ) : (
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
            {auditLog.map((entry) => {
              const actor = Array.isArray(entry.actor) ? entry.actor[0] : entry.actor
              const targetUser = Array.isArray(entry.target_user) ? entry.target_user[0] : entry.target_user
              const label = ACTION_LABELS[entry.action] ?? entry.action
              const meta = entry.metadata as Record<string, unknown> | null

              const targetLink = (() => {
                const type = entry.target_type
                if ((type === 'post') && slug) return `/communities/${slug}?tab=bulletin`
                if ((type === 'resource') && slug) return `/communities/${slug}?tab=qa`
                if (type === 'question' && slug && entry.target_id) return `/communities/${slug}/questions/${entry.target_id}`
                if (type === 'answer' && slug && typeof meta?.question_id === 'string') return `/communities/${slug}/questions/${meta.question_id}`
                if ((type === 'event') && slug) return `/communities/${slug}?tab=events`
                if (type === 'message' && typeof meta?.channel_id === 'string') return `/communities/${slug}/channels/${meta.channel_id}?message=${entry.target_id}`
                if (targetUser?.username) return `/profile/${targetUser.username}`
                return null
              })()

              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 text-sm bg-white">
                  <span className="text-stone-400 text-xs shrink-0 mt-0.5 w-32">
                    <LocalDate ts={entry.created_at} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-stone-800">
                      {actor?.display_name ?? actor?.username ?? 'Unknown'}
                    </span>
                    <span className="text-stone-500"> — {label}</span>
                    {targetUser && (
                      <span className="text-stone-400"> · {targetUser.display_name ?? targetUser.username}</span>
                    )}
                    {entry.action === 'member.role_changed' && meta && (
                      <span className="text-stone-400"> · {String(meta.from_role)} → {String(meta.to_role)}</span>
                    )}
                    {entry.action === 'community.ownership_transferred' && typeof meta?.from_owner_name === 'string' && (
                      <span className="text-stone-400"> · from {meta.from_owner_name}</span>
                    )}
                    {entry.action === 'email.blast' && meta && (
                      <span className="text-stone-400"> · "{String(meta.subject)}" · {String(meta.recipient_count)} recipients</span>
                    )}
                    {targetLink && (
                      <Link href={targetLink} className="ml-2 text-xs text-orange-500 hover:text-orange-700 hover:underline shrink-0">
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
