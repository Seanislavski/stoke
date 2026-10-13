'use client'

import { useState } from 'react'
import { submitStoryReply } from '@/app/actions/stories'

type Props = { storyId: string; communityId: string; slug: string }

export default function StoryReplyForm({ storyId, communityId, slug }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setLoading(true)
    setError('')
    const result = await submitStoryReply(storyId, communityId, slug, new FormData(form))
    setLoading(false)
    if (result.error) setError(result.error)
    else form.reset() // the page revalidates and shows the new reply
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-stone-800">Reply</h3>
      <textarea
        name="body"
        rows={3}
        required
        maxLength={4000}
        placeholder="Say something kind, or share what this brought up for you…"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-y"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '…' : 'Post reply'}
      </button>
    </form>
  )
}
