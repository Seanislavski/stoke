import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

const joinModeLabel: Record<string, string> = {
  open: 'Open to join',
  request: 'Request to join',
  invite_only: 'Invite only',
}

async function getCommunity(slug: string) {
  const admin = createAdminClient()
  const { data: community } = await admin
    .from('communities')
    .select('id, name, slug, description, join_mode, is_listed, image_url')
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
  if (!community) return { title: 'Community not found — Stoke' }
  return {
    title: `${community.name} — Stoke Community`,
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
      </main>

      <MarketingFooter />
    </div>
  )
}
