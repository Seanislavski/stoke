'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { claimCapture } from '@/app/actions/captures'
import { captureDestination, claimCopy } from '@/lib/claim'

type Result = {
  slug?: string
  questionId?: string | null
  reviewId?: string | null
  credited?: boolean
}

export default function ClaimCapture({ token, isTestimonial = false }: { token: string; isTestimonial?: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const copy = claimCopy(isTestimonial)

  if (result) {
    const href = captureDestination({ ...result, isTestimonial })
    // reattributeReview declines when the claimer already has a review in this
    // scope (one review per person). The claim is recorded either way, but the
    // quote keeps its Discord credit — say that instead of "credited to you".
    const partial = result.reviewId && result.credited === false
    return (
      <div className="text-center space-y-3">
        <p className="text-3xl">{partial ? '✅' : '🎉'}</p>
        <p className="text-stone-800 font-medium">
          {partial ? 'Claimed.' : copy.done}
        </p>
        <p className="text-sm text-stone-500">
          {partial
            ? 'You’ve already left a review for this community, and everyone gets one — so this quote keeps its “shared on Discord” credit rather than replacing it.'
            : copy.doneSub}
        </p>
        <Link href={href} className="inline-block bg-orange-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-orange-700">
          {copy.seeIt}
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null)
          startTransition(() => void (async () => {
            const res = await claimCapture(token)
            if (res.error) setError(res.error)
            else setResult(res)
          })())
        }}
        className="bg-orange-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-orange-700 disabled:opacity-50"
      >
        {pending ? 'Claiming…' : isTestimonial ? 'Claim this quote' : 'Claim this post'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
