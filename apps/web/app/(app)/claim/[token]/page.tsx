import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ClaimCapture from '@/components/community/ClaimCapture'

// Landing page for a Discord-capture claim link (sent only to the original
// author's Discord DM). Claiming links the archived post to their Stoke profile.
// Middleware sends logged-out visitors to signup with this path preserved.
export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/signup?redirect=/claim/${token}`)

  const admin = createAdminClient()
  const { data: capture } = await admin
    .from('discord_captures')
    .select('id, content, discord_author_name, consent_status, claimed_by, question_id, answer_id, community_id')
    .eq('claim_token', token)
    .maybeSingle()

  const { data: community } = capture
    ? await admin.from('communities').select('name, slug').eq('id', capture.community_id).single()
    : { data: null }

  const alreadyMine = capture?.claimed_by === user.id
  const claimedByOther = !!capture?.claimed_by && !alreadyMine
  const claimable = capture && !capture.claimed_by && capture.consent_status !== 'declined'

  return (
    <div className="max-w-lg mx-auto py-16 px-4">
      <div className="bg-white border border-stone-200 rounded-xl p-8 space-y-5">
        <div className="text-center">
          <p className="text-3xl mb-2">📚</p>
          <h1 className="text-xl font-semibold text-stone-900">Claim your post</h1>
          {community && (
            <p className="text-sm text-stone-500 mt-1">
              Archived in {community.name}’s library by Silas!, with your permission.
            </p>
          )}
        </div>

        {!capture ? (
          <p className="text-sm text-stone-500 text-center">
            This claim link isn’t valid — it may have been removed.{' '}
            <Link href="/home" className="text-orange-600 hover:underline">Go home</Link>
          </p>
        ) : claimedByOther ? (
          <p className="text-sm text-stone-500 text-center">This post has already been claimed.</p>
        ) : alreadyMine ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-green-700 font-medium">✓ Already yours — this post is linked to your profile.</p>
            {community && (
              <Link href={
                capture.question_id
                  ? `/communities/${community.slug}/questions/${capture.question_id}`
                  : `/communities/${community.slug}?tab=qa`
              } className="text-sm text-orange-600 hover:underline">
                See it on Stoke →
              </Link>
            )}
          </div>
        ) : (
          <>
            <blockquote className="border-l-4 border-orange-200 bg-stone-50 rounded-r-lg p-3 text-sm text-stone-600 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {capture.content}
            </blockquote>
            <p className="text-xs text-stone-500 text-center">
              Claiming links this post to your profile — your name here on Stoke replaces the
              “shared on Discord” credit, and it stays yours.
            </p>
            {claimable && <ClaimCapture token={token} />}
          </>
        )}
      </div>
    </div>
  )
}
