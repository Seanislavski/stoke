'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { claimCapture } from '@/app/actions/captures'

export default function ClaimCapture({ token }: { token: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ slug?: string; questionId?: string | null } | null>(null)

  if (result) {
    const href = result.slug
      ? result.questionId
        ? `/communities/${result.slug}/questions/${result.questionId}`
        : `/communities/${result.slug}?tab=qa`
      : '/home'
    return (
      <div className="text-center space-y-3">
        <p className="text-3xl">🎉</p>
        <p className="text-stone-800 font-medium">It’s yours now.</p>
        <p className="text-sm text-stone-500">The post is linked to your profile.</p>
        <Link href={href} className="inline-block bg-orange-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-orange-700">
          See it on Stoke →
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
        {pending ? 'Claiming…' : 'Claim this post'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
