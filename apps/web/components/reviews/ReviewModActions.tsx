'use client'

import { useState } from 'react'
import { approveReview, rejectReview, toggleFeatureReview, deleteReview } from '@/app/actions/reviews'

type Props = {
  reviewId: string
  communityId: string | null
  slug: string | null
  status: 'pending' | 'published' | 'rejected'
  isFeatured: boolean
}

export default function ReviewModActions({ reviewId, communityId, slug, status, isFeatured }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function run(action: string, fn: () => Promise<{ error?: string }>) {
    setLoading(action)
    setError('')
    const result = await fn()
    setLoading(null)
    if (result?.error) setError(result.error)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {status === 'pending' && (
        <>
          <button
            onClick={() => run('approve', () => approveReview(reviewId, communityId, slug))}
            disabled={!!loading}
            className="text-xs px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full font-medium transition-colors disabled:opacity-50"
          >
            {loading === 'approve' ? '…' : 'Approve'}
          </button>
          <button
            onClick={() => run('reject', () => rejectReview(reviewId, communityId, slug))}
            disabled={!!loading}
            className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full font-medium transition-colors disabled:opacity-50"
          >
            {loading === 'reject' ? '…' : 'Reject'}
          </button>
        </>
      )}

      {status === 'published' && (
        <button
          onClick={() => run('feature', () => toggleFeatureReview(reviewId, communityId, slug))}
          disabled={!!loading}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${
            isFeatured
              ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
              : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
          }`}
        >
          {loading === 'feature' ? '…' : isFeatured ? '★ Featured — unfeature' : '☆ Feature publicly'}
        </button>
      )}

      <button
        onClick={() => run('delete', () => deleteReview(reviewId, communityId, slug))}
        disabled={!!loading}
        className="text-xs px-3 py-1 text-stone-400 hover:text-red-600 rounded-full font-medium transition-colors disabled:opacity-50"
      >
        {loading === 'delete' ? '…' : 'Delete'}
      </button>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
