import { createAdminClient } from '@/lib/supabase/admin'
import ReviewsManager from '@/components/reviews/ReviewsManager'
import { REVIEW_COLS, mapReview, type RawReview } from '@/lib/reviews'

export default async function AdminReviewsPage() {
  const admin = createAdminClient()
  const { data: reviewsRaw } = await admin
    .from('reviews')
    .select(REVIEW_COLS)
    .is('community_id', null)
    .order('created_at', { ascending: false })

  const reviews = ((reviewsRaw ?? []) as RawReview[]).map(mapReview)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Platform Reviews</h1>
        <p className="mt-1 text-sm text-stone-500">
          Reviews of Stoke itself. Approve, reply, and feature up to 6 as testimonials on the homepage.
        </p>
      </div>
      <ReviewsManager communityId={null} slug={null} initialReviews={reviews} />
    </div>
  )
}
