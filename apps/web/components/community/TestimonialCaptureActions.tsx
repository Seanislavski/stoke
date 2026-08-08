'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishCaptureAsTestimonial, discardCapture } from '@/app/actions/captures'

// Filing controls for one granted Discord testimonial capture.
// The scope choice is the substance here: praise written in a community's Discord
// is almost always about THAT community. Publishing it as a review of Stoke puts
// words in the author's mouth about a product they may never have opened — so the
// community option is the default and the platform option carries a warning.
export default function TestimonialCaptureActions({
  captureId,
  communityId,
  communityName,
  slug,
  suggestedScope,
}: {
  captureId: string
  communityId: string
  communityName: string
  slug: string
  suggestedScope: 'community' | 'platform' | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [scope, setScope] = useState<'community' | 'platform'>(suggestedScope ?? 'community')
  const [rating, setRating] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (done) return <p className="text-sm text-green-700 font-medium mt-3">✓ {done}</p>

  function run(action: () => Promise<{ error?: string }>, doneLabel: string) {
    setError(null)
    startTransition(() => void (async () => {
      const res = await action()
      if (res.error) setError(res.error)
      else {
        setDone(doneLabel)
        router.refresh()
      }
    })())
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2 text-xs flex-wrap">
        <button
          type="button"
          onClick={() => setScope('community')}
          className={`px-2 py-1 rounded border ${scope === 'community' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
        >
          About {communityName}
        </button>
        <button
          type="button"
          onClick={() => setScope('platform')}
          className={`px-2 py-1 rounded border ${scope === 'platform' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
        >
          About Stoke itself
        </button>
      </div>

      {scope === 'platform' && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          This will be featurable on the Stoke homepage. Only pick it if they were
          talking about the platform — not about the community.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={rating}
          onChange={e => setRating(e.target.value)}
          className="text-sm border border-stone-200 rounded-lg px-2 py-1.5 bg-white sm:w-48"
        >
          <option value="">No star rating</option>
          {[5, 4, 3, 2, 1].map(n => (
            <option key={n} value={n}>{'★'.repeat(n)} ({n}/5)</option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(
            () => publishCaptureAsTestimonial(captureId, communityId, slug, scope, rating ? Number(rating) : null),
            scope === 'platform' ? 'Published as a Stoke testimonial' : 'Published as a testimonial',
          )}
          className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? 'Publishing…' : 'Publish testimonial'}
        </button>
      </div>

      <p className="text-xs text-stone-400">
        Publishing does not feature it — feature the ones you want public below.
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Discard this capture? The author gave permission, but nothing will be published.')) return
          run(() => discardCapture(captureId, communityId, slug), 'Discarded')
        }}
        className="text-xs text-stone-400 hover:text-red-600"
      >
        Discard
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
