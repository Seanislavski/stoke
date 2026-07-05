'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishExistingQuestion } from '@/app/actions/qotw'

export default function PublishAsQotwButton({
  questionId,
  communityId,
  slug,
  isPending,
}: {
  questionId: string
  communityId: string
  slug: string
  isPending: boolean
}) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    const msg = isPending
      ? 'Publish this question as the next Question of the Week? It will be approved, given a QotW number and permanent link, and become the current spotlight.'
      : 'Publish this question as the next Question of the Week? It will get a QotW number and permanent link, and become the current spotlight. The asker keeps credit.'
    if (!window.confirm(msg)) return
    setError('')
    startTransition(async () => {
      const result = await publishExistingQuestion(questionId, communityId, slug)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Publishing…' : '⭐ Publish as Question of the Week'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
