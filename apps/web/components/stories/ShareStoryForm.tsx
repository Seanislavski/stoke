'use client'

import { useState } from 'react'
import { submitStory } from '@/app/actions/stories'

type Props = { communityId: string; slug: string; isMod: boolean }

export default function ShareStoryForm({ communityId, slug, isMod }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setLoading(true)
    setFeedback('')
    const result = await submitStory(communityId, slug, new FormData(form))
    setLoading(false)
    if (result.error) {
      setFeedback(result.error)
      return
    }
    form.reset()
    setFeedback(result.status === 'published'
      ? 'Your story is up.'
      : 'Thank you for sharing. A moderator will read it and publish it soon.')
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => { setOpen(true); setFeedback('') }}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Share your story
        </button>
        {feedback && <p className="text-sm text-stone-600">{feedback}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-stone-800">Share your story</h3>
      <input
        name="title"
        required
        maxLength={200}
        placeholder="Give it a title"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />
      <textarea
        name="body"
        rows={8}
        required
        maxLength={20000}
        placeholder="What happened, what you learned, what helped — in your own words."
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-y"
      />
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" name="anonymous" className="mt-0.5 accent-orange-500" />
        <span>
          Post anonymously
          <span className="block text-xs text-stone-400">Members will see &ldquo;Anonymous member&rdquo;. Moderators can still see it was you.</span>
        </span>
      </label>
      <p className="text-xs text-stone-400">
        {isMod ? 'As a moderator, your story goes up right away.' : 'A moderator reads every story before it appears.'}
        {' '}Only members of this community can read stories.
      </p>
      {feedback && <p className="text-sm text-stone-600">{feedback}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? '…' : isMod ? 'Post story' : 'Submit for review'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 text-sm text-stone-500 hover:text-stone-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
