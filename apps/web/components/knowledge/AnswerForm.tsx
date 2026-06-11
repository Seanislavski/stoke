'use client'

import { useState } from 'react'
import { submitAnswer } from '@/app/actions/knowledge'

type Props = { questionId: string; communityId: string; slug: string; isMod: boolean }

export default function AnswerForm({ questionId, communityId, slug, isMod }: Props) {
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setFeedback('')
    const formData = new FormData(e.currentTarget)
    const result = await submitAnswer(questionId, communityId, slug, formData)
    setLoading(false)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setFeedback(result.status === 'published' ? 'Answer posted.' : 'Answer submitted for review.')
      ;(e.target as HTMLFormElement).reset()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-stone-800">Your answer</h3>
      <textarea
        name="body"
        rows={4}
        required
        maxLength={4000}
        placeholder="Share what worked for you…"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
      />
      <input
        name="url"
        type="url"
        placeholder="Add a link (optional)"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />
      {!isMod && (
        <p className="text-xs text-stone-400">Your answer will be reviewed by a moderator before it appears.</p>
      )}
      {feedback && <p className="text-sm text-stone-600">{feedback}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '…' : isMod ? 'Post answer' : 'Submit for review'}
      </button>
    </form>
  )
}
