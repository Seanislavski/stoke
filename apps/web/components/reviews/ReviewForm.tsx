'use client'

import { useState } from 'react'
import { submitReview, editReview } from '@/app/actions/reviews'

type Existing = { id: string; body: string; rating: number | null; status: 'pending' | 'published' | 'rejected' }

type Props = {
  communityId: string | null
  slug: string | null
  isMod: boolean
  scopeLabel: string // e.g. the community name, or "Stoke"
  existing?: Existing | null
}

export default function ReviewForm({ communityId, slug, isMod, scopeLabel, existing }: Props) {
  const isEditing = !!existing
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState<number>(existing?.rating ?? 0)
  const [hover, setHover] = useState(0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setFeedback('')
    const formData = new FormData(e.currentTarget)
    formData.set('rating', rating ? String(rating) : '')
    const result = isEditing
      ? await editReview(existing!.id, communityId, slug, formData)
      : await submitReview(communityId, slug, formData)
    setLoading(false)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setOpen(false)
      setFeedback(
        result.status === 'published'
          ? 'Review posted.'
          : isEditing
            ? 'Edited — re-submitted for approval.'
            : 'Review submitted for approval.'
      )
    }
  }

  const statusNote = existing
    ? existing.status === 'pending'
      ? 'Your review is awaiting approval.'
      : existing.status === 'rejected'
        ? 'Your review was not approved. You can edit and resubmit it.'
        : 'Your review is published.'
    : ''

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isEditing ? 'Edit your review' : 'Leave a review'}
        </button>
        {statusNote && <span className="text-sm text-stone-500">{statusNote}</span>}
        {feedback && <span className="text-sm text-stone-500">{feedback}</span>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
      <div>
        <span className="block text-xs font-medium text-stone-500 mb-1">Rating (optional)</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n === rating ? 0 : n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="text-2xl leading-none transition-colors"
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
            >
              <span className={(hover || rating) >= n ? 'text-orange-500' : 'text-stone-300'}>★</span>
            </button>
          ))}
          {rating > 0 && (
            <button type="button" onClick={() => setRating(0)} className="ml-2 text-xs text-stone-400 hover:text-stone-600">
              clear
            </button>
          )}
        </div>
      </div>

      <textarea
        name="body"
        rows={4}
        required
        maxLength={2000}
        defaultValue={existing?.body ?? ''}
        placeholder={`What's your experience with ${scopeLabel} been like?`}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
      />

      {isEditing ? (
        <p className="text-xs text-amber-600">
          Editing re-submits your review for approval and removes it from public display until it&apos;s re-approved.
        </p>
      ) : !isMod ? (
        <p className="text-xs text-stone-400">Your review will be approved by a moderator before it appears.</p>
      ) : null}

      {feedback && <p className="text-sm text-red-600">{feedback}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? '…' : isEditing ? 'Save changes' : isMod ? 'Post review' : 'Submit for approval'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setFeedback('') }}
          className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
