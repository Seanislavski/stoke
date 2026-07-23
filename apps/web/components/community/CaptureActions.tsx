'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishCaptureAsAnswer, publishCaptureAsQuestion, discardCapture } from '@/app/actions/captures'

// Filing controls for one granted Discord capture on the moderation page:
// publish it as an answer to an existing question, as a brand-new question,
// or discard it. Done-in-place pattern (row shows "Done" until reload).
export default function CaptureActions({
  captureId,
  communityId,
  slug,
  questions,
}: {
  captureId: string
  communityId: string
  slug: string
  questions: { id: string; title: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'answer' | 'question'>('answer')
  const [questionId, setQuestionId] = useState('')
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
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode('answer')}
          className={`px-2 py-1 rounded border ${mode === 'answer' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
        >
          Answer to a question
        </button>
        <button
          type="button"
          onClick={() => setMode('question')}
          className={`px-2 py-1 rounded border ${mode === 'question' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
        >
          New question
        </button>
      </div>

      {mode === 'answer' ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={questionId}
            onChange={e => setQuestionId(e.target.value)}
            className="flex-1 text-sm border border-stone-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">Pick a question…</option>
            {questions.map(q => (
              <option key={q.id} value={q.id}>{q.title}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !questionId}
            onClick={() => run(() => publishCaptureAsAnswer(captureId, communityId, slug, questionId), 'Published as an answer')}
            className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
          >
            {pending ? 'Publishing…' : 'Publish answer'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Question title (the capture becomes the body)"
            className="flex-1 text-sm border border-stone-200 rounded-lg px-2 py-1.5"
          />
          <button
            type="button"
            disabled={pending || !title.trim()}
            onClick={() => run(() => publishCaptureAsQuestion(captureId, communityId, slug, title), 'Published as a question')}
            className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
          >
            {pending ? 'Publishing…' : 'Publish question'}
          </button>
        </div>
      )}

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
