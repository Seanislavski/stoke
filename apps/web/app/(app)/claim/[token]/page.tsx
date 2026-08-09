import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClaimCapture from '@/components/community/ClaimCapture'
import { captureDestination, claimCopy } from '@/lib/claim'

// Landing page for a Discord-capture claim link (sent only to the original
// author's Discord DM). Claiming links the archived post to their Stoke profile.
// Middleware sends logged-out visitors to signup with this path preserved.
//
// ⚠️ Serves BOTH kinds of capture. A testimonial has no question_id, so every
// branch here has to account for it or the page describes a library archive
// that doesn't exist and links to a tab the content isn't on.
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/signup?redirect=/claim/${token}`)

  const admin = createAdminClient()
  const { data: capture } = await admin
    .from('discord_captures')
    .select('id, content, discord_author_name, consent_status, claimed_by, question_id, answer_id, review_id, kind, community_id')
    .eq('claim_token', token)
    .maybeSingle()

  const { data: community } = capture
    ? await admin.from('communities').select('name, slug').eq('id', capture.community_id).single()
    : { data: null }

  const alreadyMine = capture?.claimed_by === user.id
  const claimedByOther = !!capture?.claimed_by && !alreadyMine
  const claimable = capture && !capture.claimed_by && capture.consent_status !== 'declined'

  // `kind` is the intent recorded at capture time; review_id is where it landed.
  // Either is enough — a testimonial that hasn't been filed yet has only `kind`.
  const isTestimonial = capture?.kind === 'testimonial' || !!capture?.review_id
  const copy = claimCopy(isTestimonial)

  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <div className="bg-white border border-stone-200 rounded-xl p-8 space-y-5">
        <div className="text-center">
          <p className="text-3xl mb-2">{copy.icon}</p>
          <h1 className="text-xl font-semibold text-stone-900">{copy.heading}</h1>
          {community && (
            <p className="text-sm text-stone-500 mt-1">{copy.sub(community.name)}</p>
          )}
        </div>

        {!capture ? (
          <p className="text-sm text-stone-500 text-center">
            This claim link isn’t valid — it may have been removed.{' '}
            <Link href="/home" className="text-orange-600 hover:underline">Go home</Link>
          </p>
        ) : claimedByOther ? (
          <p className="text-sm text-stone-500 text-center">
            This {isTestimonial ? 'quote' : 'post'} has already been claimed.
          </p>
        ) : alreadyMine ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-green-700 font-medium">
              ✓ Already claimed — credited to your profile.
            </p>
            {community && (
              <Link
                href={captureDestination({
                  slug: community.slug,
                  questionId: capture.question_id,
                  reviewId: capture.review_id,
                  isTestimonial,
                })}
                className="text-sm text-orange-600 hover:underline"
              >
                {copy.seeIt}
              </Link>
            )}
          </div>
        ) : (
          <>
            <blockquote className="border-l-4 border-orange-200 bg-stone-50 rounded-r-lg p-3 text-sm text-stone-600 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {capture.content}
            </blockquote>
            <p className="text-xs text-stone-500 text-center">{copy.explain}</p>
            {claimable && <ClaimCapture token={token} isTestimonial={isTestimonial} />}
          </>
        )}
      </div>
    </div>
  )
}
