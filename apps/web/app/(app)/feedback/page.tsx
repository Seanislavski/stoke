import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ReviewForm from '@/components/reviews/ReviewForm'

export const metadata: Metadata = { title: 'Share your experience' }

type ExistingReview = { id: string; body: string; rating: number | null; status: 'pending' | 'published' | 'rejected' }

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: existing }, { data: platformRole }] = await Promise.all([
    admin.from('reviews').select('id, body, rating, status').is('community_id', null).eq('author_id', user.id).maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Share your experience with Stoke</h1>
        <p className="mt-2 text-stone-500 text-sm leading-relaxed">
          If Stoke has helped you build or be part of a community, we&apos;d love to hear about it.
          Reviews are read by our team, and featured ones may appear on our homepage as testimonials.
        </p>
      </div>
      <ReviewForm
        communityId={null}
        slug={null}
        isMod={!!platformRole}
        scopeLabel="Stoke"
        existing={(existing as ExistingReview | null) ?? null}
      />
    </div>
  )
}
