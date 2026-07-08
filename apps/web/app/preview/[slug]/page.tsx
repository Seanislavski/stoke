import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'
import RichContent from '@/components/RichContent'
import PhotoGallery from '@/components/PhotoGallery'

const joinModeLabel: Record<string, string> = {
  open: 'Open to join',
  request: 'Request to join',
  invite_only: 'Invite only',
}

async function getCommunity(slug: string) {
  const admin = createAdminClient()
  const { data: community } = await admin
    .from('communities')
    .select('id, name, slug, description, about, join_mode, is_listed, image_url, banner_url, photos')
    .eq('slug', slug)
    .single()
  return community
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunity(slug)
  if (!community) return { title: 'Community not found' }
  return {
    title: community.name,
    description: community.description ?? `Join ${community.name} on Stoke.`,
    openGraph: {
      title: `${community.name} on Stoke`,
      description: community.description ?? `Join ${community.name} on Stoke.`,
      url: `https://stoke.community/communities/${community.slug}`,
    },
  }
}

export default async function CommunityPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const community = await getCommunity(slug)
  if (!community) notFound()

  const admin = createAdminClient()

  // Member count is safe to show for any community known by slug.
  const { count: memberCount } = await admin
    .from('community_members')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', community.id)
    .eq('status', 'active')

  // Featured reviews are an explicit organizer-curated public testimonial, so they
  // show regardless of listing status (the organizer chose to feature each one).
  const { data: featuredReviewsRaw } = await admin
    .from('reviews')
    .select('id, body, rating, reply_body, reply_is_public, profiles!author_id(username, display_name, avatar_url)')
    .eq('community_id', community.id)
    .eq('status', 'published')
    .eq('is_featured', true)
    .order('featured_position', { ascending: true })
    .order('published_at', { ascending: false })
    .limit(6)

  type RawReview = {
    id: string; body: string; rating: number | null; reply_body: string | null; reply_is_public: boolean
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | { username: string; display_name: string | null; avatar_url: string | null }[] | null
  }
  const featuredReviews = ((featuredReviewsRaw ?? []) as RawReview[]).map(r => {
    const a = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id: r.id, body: r.body, rating: r.rating,
      name: a?.display_name ?? a?.username ?? 'Member', avatar: a?.avatar_url ?? null,
      reply: r.reply_is_public ? r.reply_body : null,
    }
  })

  // Only listed communities expose a content teaser — unlisted ones stay private.
  const recentPosts = community.is_listed
    ? (await admin
        .from('bulletin_posts')
        .select('id, title, published_at')
        .eq('community_id', community.id)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(4)).data
    : null

  const canonicalPath = `/communities/${community.slug}`
  const signupHref = `/signup?redirect=${encodeURIComponent(canonicalPath)}`
  const loginHref = `/login?redirect=${encodeURIComponent(canonicalPath)}`

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Marketing header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <StokeWordmark iconSize={28} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href={loginHref} className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
              Sign in
            </Link>
            <Link href={signupHref} className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10">
        {/* Cover image */}
        {community.banner_url && (
          <div className="w-full aspect-[3/1] rounded-2xl overflow-hidden border border-stone-200 mb-6">
            <img src={community.banner_url} alt={`${community.name} cover`} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Community header card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            {community.image_url && (
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-stone-100">
                <Image src={community.image_url} alt={community.name} width={64} height={64} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">{community.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
                <span>{joinModeLabel[community.join_mode] ?? 'Community'}</span>
                {typeof memberCount === 'number' && (
                  <>
                    <span>·</span>
                    <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {community.description && (
            <p className="mt-5 text-stone-600 leading-relaxed">{community.description}</p>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href={signupHref}
              className="w-full sm:w-auto text-center bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              {community.join_mode === 'invite_only' ? 'Sign up to join' : `Join ${community.name}`}
            </Link>
            <Link
              href={loginHref}
              className="w-full sm:w-auto text-center bg-white border border-stone-300 text-stone-700 px-6 py-3 rounded-xl font-semibold hover:bg-stone-50 transition-colors"
            >
              I already have an account
            </Link>
          </div>
          {community.join_mode === 'invite_only' && (
            <p className="mt-3 text-xs text-stone-400">
              This community is invite only — you&apos;ll need an invite link from an organizer to join.
            </p>
          )}
        </div>

        {/* About — listed communities only (unlisted stay private) */}
        {community.is_listed && community.about && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">About</h2>
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <RichContent content={community.about} embeds={false} className="text-stone-700 leading-relaxed break-words whitespace-pre-wrap" />
            </div>
          </div>
        )}

        {/* Photo gallery — listed communities only */}
        {community.is_listed && community.photos && community.photos.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Photos</h2>
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <PhotoGallery photos={community.photos} />
            </div>
          </div>
        )}

        {/* Content teaser (listed communities only) */}
        {community.is_listed ? (
          recentPosts && recentPosts.length > 0 ? (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Recent from the bulletin board
              </h2>
              <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
                {recentPosts.map(post => {
                  const date = post.published_at
                    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : ''
                  return (
                    <div key={post.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-sm font-medium text-stone-800 truncate">{post.title}</span>
                      {date && <span className="text-xs text-stone-400 shrink-0">{date}</span>}
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-sm text-stone-400">
                Join to read the full posts, RSVP to events, browse the Q&amp;A, and join the conversation.
              </p>
            </div>
          ) : null
        ) : (
          <div className="mt-8 bg-stone-100 rounded-2xl p-6 text-center">
            <p className="text-sm text-stone-500">
              This is a private community. Sign in and join to see the bulletin board, events, Q&amp;A, and members.
            </p>
          </div>
        )}

        {/* Featured reviews — organizer-curated testimonials */}
        {featuredReviews.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
              What members say
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featuredReviews.map(r => (
                <div key={r.id} className="bg-white rounded-2xl border border-stone-200 p-5">
                  {r.rating && (
                    <div className="text-orange-500 text-sm mb-2 tracking-tight">
                      {'★'.repeat(r.rating)}<span className="text-stone-300">{'★'.repeat(5 - r.rating)}</span>
                    </div>
                  )}
                  <p className="text-stone-700 text-sm leading-relaxed">&ldquo;{r.body}&rdquo;</p>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-xs font-semibold text-stone-500 overflow-hidden">
                      {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" /> : r.name[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-stone-600">{r.name}</span>
                  </div>
                  {r.reply && (
                    <div className="mt-3 border-l-2 border-orange-200 pl-3">
                      <p className="text-xs font-semibold text-orange-600">Response from the organizers</p>
                      <p className="mt-1 text-sm text-stone-600 leading-relaxed">{r.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <MarketingFooter />
    </div>
  )
}
