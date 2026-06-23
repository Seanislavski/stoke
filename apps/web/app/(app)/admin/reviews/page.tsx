import { createAdminClient } from '@/lib/supabase/admin'
import ReviewList, { type ReviewItem } from '@/components/reviews/ReviewList'

type RawReview = {
  id: string; body: string; rating: number | null; status: 'pending' | 'published' | 'rejected'; is_featured: boolean; created_at: string
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | { username: string; display_name: string | null; avatar_url: string | null }[] | null
}

function toItem(r: RawReview): ReviewItem {
  const a = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
  return {
    id: r.id, body: r.body, rating: r.rating, status: r.status, is_featured: r.is_featured, created_at: r.created_at,
    author_username: a?.username ?? null, author_name: a?.display_name ?? null, author_avatar: a?.avatar_url ?? null,
  }
}

const COLS = 'id, body, rating, status, is_featured, created_at, profiles!author_id(username, display_name, avatar_url)'

export default async function AdminReviewsPage() {
  const admin = createAdminClient()
  const [{ data: pendingRaw }, { data: publishedRaw }] = await Promise.all([
    admin.from('reviews').select(COLS).is('community_id', null).eq('status', 'pending').order('created_at', { ascending: false }),
    admin.from('reviews').select(COLS).is('community_id', null).eq('status', 'published')
      .order('is_featured', { ascending: false }).order('published_at', { ascending: false }),
  ])

  const pending = ((pendingRaw ?? []) as RawReview[]).map(toItem)
  const published = ((publishedRaw ?? []) as RawReview[]).map(toItem)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Platform Reviews</h1>
        <p className="mt-1 text-sm text-stone-500">
          Reviews of Stoke itself. Approve to accept, then feature the best ones to show them as testimonials on the homepage.
        </p>
      </div>

      <section>
        <h2 className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-3">Awaiting approval ({pending.length})</h2>
        {pending.length > 0 ? (
          <ReviewList reviews={pending} communityId={null} slug={null} isMod />
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
            Nothing awaiting approval
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">Published ({published.length})</h2>
        {published.length > 0 ? (
          <ReviewList reviews={published} communityId={null} slug={null} isMod />
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
            No published platform reviews yet
          </div>
        )}
      </section>
    </div>
  )
}
