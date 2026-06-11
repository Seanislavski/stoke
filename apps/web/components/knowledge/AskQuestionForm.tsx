'use client'

import { useState } from 'react'
import { submitQuestion } from '@/app/actions/knowledge'

type Category = { id: string; name: string }
type Props = { communityId: string; slug: string; isMod: boolean; categories: Category[] }

export default function AskQuestionForm({ communityId, slug, isMod, categories }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setFeedback('')
    const formData = new FormData(e.currentTarget)
    const result = await submitQuestion(communityId, slug, formData)
    setLoading(false)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setOpen(false)
      setFeedback(result.status === 'published' ? 'Question posted.' : 'Question submitted for review.')
      ;(e.target as HTMLFormElement).reset()
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Ask a question
        </button>
        {feedback && <span className="text-sm text-stone-500">{feedback}</span>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
      <input
        name="title"
        type="text"
        required
        maxLength={160}
        placeholder="What's your question?"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />
      <textarea
        name="body"
        rows={4}
        maxLength={2000}
        placeholder="Add any detail that will help people answer well (optional)"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
      />
      {isMod && categories.length > 0 && (
        <select
          name="category_id"
          defaultValue=""
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
        >
          <option value="">No category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {!isMod && (
        <p className="text-xs text-stone-400">Your question will be reviewed by a moderator before it appears.</p>
      )}
      {feedback && <p className="text-sm text-red-600">{feedback}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? '…' : isMod ? 'Post question' : 'Submit for review'}
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
