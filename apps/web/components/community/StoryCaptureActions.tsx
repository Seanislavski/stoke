'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishCaptureAsStory, discardCapture } from '@/app/actions/captures'

// Filing controls for one granted Discord story capture on the moderation page:
// give it a title and publish it to Stories, or discard it. Same done-in-place
// pattern as CaptureActions.
export default function StoryCaptureActions({
  captureId,
  communityId,
  slug,
}: {
  captureId: string
  communityId: string
  slug: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
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
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Story title (the capture becomes the story)"
          className="flex-1 text-sm border border-stone-200 rounded-lg px-2 py-1.5"
        />
        <button
          type="button"
          disabled={pending || !title.trim()}
          onClick={() => run(() => publishCaptureAsStory(captureId, communityId, slug, title), 'Published as a story')}
          className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? 'Publishing…' : 'Publish story'}
        </button>
      </div>

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
