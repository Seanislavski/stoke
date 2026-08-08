import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import RichContent from '@/components/RichContent'
import PhotoGallery from '@/components/PhotoGallery'
import ReviewsManager from '@/components/reviews/ReviewsManager'
import TestimonialCaptureActions from '@/components/community/TestimonialCaptureActions'
import { REVIEW_COLS, mapReview, type RawReview } from '@/lib/reviews'

// Everything testimonial in one mod-facing place: what Discord members said and
// consented to (waiting to be filed), then the community's own reviews with the
// approve / reply / feature controls. Community reviews surface on the community
// preview page; captures filed as "about Stoke itself" go to /admin/reviews.
export default async function TestimonialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, owner_id')
    .eq('slug', slug)
    .single()
  if (!community) notFound()

  const isOwner = user.id === community.owner_id
  const admin = createAdminClient()
  const [{ data: membership }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('role').eq('community_id', community.id).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isMod = !!platformRole || isOwner || ['organizer', 'moderator'].includes(membership?.role ?? '')
  if (!isMod) redirect(`/communities/${slug}`)

  const isPlatformStaff = !!platformRole

  // Granted testimonial captures not yet filed. Same fail-safe as the review
  // queue: if the table or the `kind` column is missing, the inbox reads empty
  // rather than throwing.
  const [captureRows, reviewsRaw] = await Promise.all([
    admin.from('discord_captures')
      .select('id, content, photos, discord_author_name, discord_message_url, consent_status, consent_answered_at, review_scope')
      .eq('community_id', community.id)
      .eq('kind', 'testimonial')
      .in('consent_status', ['granted_credited', 'granted_anon'])
      .is('review_id', null).is('dismissed_at', null)
      .order('consent_answered_at', { ascending: true })
      .then(r => r.data ?? []),
    admin.from('reviews')
      .select(REVIEW_COLS)
      .eq('community_id', community.id)
      .order('created_at', { ascending: false })
      .then(r => r.data ?? []),
  ])

  const reviewItems = (reviewsRaw as RawReview[]).map(mapReview)

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8 px-4">
      <div>
        <Link href={`/communities/${slug}`} className="text-sm text-stone-400 hover:text-stone-700">
          ← Back to {community.name}
        </Link>
        <h1 className="text-2xl font-semibold text-stone-900 mt-2">Testimonials</h1>
        <p className="text-sm text-stone-500 mt-1">
          What members say about {community.name}, from inside the community and from Discord.
          Feature up to 6 to show them publicly.
        </p>
      </div>

      {/* ── From Discord ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-stone-800">
            From Discord
            {captureRows.length > 0 && (
              <span className="ml-2 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full align-middle">
                {captureRows.length}
              </span>
            )}
          </h2>
          <span className="text-xs text-stone-400">
            Captured with Silas → the author granted permission
          </span>
        </div>

        {captureRows.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-6 text-center">
            <p className="text-sm text-stone-500">Nothing waiting.</p>
            <p className="text-xs text-stone-400 mt-1">
              In Discord, right-click a message → Apps → “Capture testimonial”. Silas asks
              the author for permission before anything appears here.
            </p>
          </div>
        ) : (
          captureRows.map((c: {
            id: string; content: string; photos: string[] | null
            discord_author_name: string; discord_message_url: string
            consent_status: string; review_scope: string | null
          }) => (
            <div key={c.id} className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-medium text-stone-900">
                  {c.consent_status === 'granted_credited' ? c.discord_author_name : 'a community member'}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                  {c.consent_status === 'granted_credited' ? 'credited' : 'anonymous'}
                </span>
                <a
                  href={c.discord_message_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-stone-400 hover:text-orange-600"
                >
                  original ↗
                </a>
              </div>

              <div className="mt-2 text-sm text-stone-700">
                <RichContent content={c.content} />
              </div>
              {c.photos && c.photos.length > 0 && (
                <div className="mt-2">
                  <PhotoGallery photos={c.photos} />
                </div>
              )}

              <TestimonialCaptureActions
                captureId={c.id}
                communityId={community.id}
                communityName={community.name}
                slug={slug}
                suggestedScope={c.review_scope === 'platform' ? 'platform' : c.review_scope === 'community' ? 'community' : null}
              />
            </div>
          ))
        )}
      </section>

      {/* ── The community's own reviews ──────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-stone-800">
            Reviews of {community.name}
          </h2>
          <p className="text-sm text-stone-500">
            Approve member reviews, reply to them, and feature up to 6 as public
            testimonials on your community&apos;s preview page.
          </p>
        </div>
        <ReviewsManager communityId={community.id} slug={slug} initialReviews={reviewItems} />
      </section>

      {isPlatformStaff && (
        <p className="text-xs text-stone-400 border-t border-stone-200 pt-4">
          Testimonials filed as “About Stoke itself” live in{' '}
          <Link href="/admin/reviews" className="text-orange-600 hover:underline">Platform Reviews</Link>.
        </p>
      )}
    </div>
  )
}
