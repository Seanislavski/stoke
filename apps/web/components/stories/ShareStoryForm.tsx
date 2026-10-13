'use client'

import { useState } from 'react'
import { submitStory } from '@/app/actions/stories'

type Props = { communityId: string; slug: string; isMod: boolean }

// Tapping one fills in the title, so nobody has to start from a blank page.
// They run from small to big on purpose — a short moment and a whole journey
// both belong here.
const PROMPTS = [
  'A small win I’m proud of',
  'A day that went better than I expected',
  'Something that finally worked for me',
  'Something people get wrong about me',
  'What I wish someone had told me sooner',
  'The moment I realized my brain works differently',
]

export default function ShareStoryForm({ communityId, slug, isMod }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
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
    setTitle('')
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
          Share a moment or a story
        </button>
        {feedback && <p className="text-sm text-stone-600">{feedback}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">Share a moment or a story</h3>
        <p className="text-xs text-stone-500 mt-0.5">Big or small: a few sentences or a few pages, it all belongs here.</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-stone-400">Not sure where to start? Tap one:</p>
        <div className="flex flex-wrap gap-1.5">
          {PROMPTS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setTitle(p)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                title === p
                  ? 'bg-orange-50 border-orange-300 text-orange-700'
                  : 'bg-white border-stone-200 text-stone-600 hover:border-orange-300 hover:text-orange-600'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <input
        name="title"
        required
        maxLength={200}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Give it a title"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />
      <textarea
        name="body"
        rows={8}
        required
        maxLength={20000}
        placeholder="What happened, what it was like, what helped — in your own words."
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
