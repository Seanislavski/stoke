'use client'

import { useState } from 'react'
import { submitResource } from '@/app/actions/resources'

type Props = { communityId: string; slug: string; isMod: boolean }

export default function SubmitResourceForm({ communityId, slug, isMod }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setFeedback('')
    const formData = new FormData(e.currentTarget)
    const result = await submitResource(communityId, slug, formData)
    setLoading(false)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setOpen(false)
      setFeedback(result.status === 'published' ? 'Resource added.' : 'Resource submitted for review.')
      ;(e.target as HTMLFormElement).reset()
    }
  }

  const TYPES = ['article', 'video', 'tool', 'book', 'other']

  return (
    <div>
      {!open ? (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="text-sm text-orange-600 hover:underline font-medium"
          >
            + {isMod ? 'Add a resource' : 'Submit a resource'}
          </button>
          {feedback && <span className="text-sm text-stone-500">{feedback}</span>}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
          <input
            name="title"
            type="text"
            required
            maxLength={120}
            placeholder="Title"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
          <input
            name="url"
            type="url"
            required
            placeholder="https://..."
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
          <textarea
            name="description"
            rows={3}
            maxLength={500}
            placeholder="Why is this useful? (optional)"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
          />
          <select
            name="resource_type"
            defaultValue="other"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
          >
            {TYPES.map(t => (
              <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          {feedback && <p className="text-sm text-red-600">{feedback}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '…' : isMod ? 'Add resource' : 'Submit for review'}
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
      )}
    </div>
  )
}
