'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createTicket } from '@/app/actions/tickets'

type Community = { id: string; name: string }
type Category = { key: string; label: string }

export default function NewTicketForm({
  orgCommunities,
  categories,
}: {
  orgCommunities: Community[]
  categories: Category[]
}) {
  const searchParams = useSearchParams()
  const paramCategory = searchParams.get('category')
  const paramSubject = searchParams.get('subject') ?? ''
  const validCategory = categories.find(c => c.key === paramCategory)?.key ?? categories[0]?.key ?? 'other'

  const [open, setOpen] = useState(!!paramCategory)
  const [category, setCategory] = useState(validCategory)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createTicket(formData)
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`/support/${result.ticketId}`)
      }
    })
  }

  return (
    <div className="mb-6">
      {!open ? (
        <div className="flex justify-end">
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New ticket
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-stone-700">New support ticket</h2>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Category</label>
            <select
              name="category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {categories.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          {orgCommunities.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Community {category === 'community_issue' ? '*' : '(optional)'}
              </label>
              <select
                name="community_id"
                required={category === 'community_issue'}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {category !== 'community_issue' && <option value="">— None —</option>}
                {orgCommunities.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Subject *</label>
            <input
              name="title"
              required
              maxLength={120}
              defaultValue={paramSubject}
            placeholder="Brief summary of the issue"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Message *</label>
            <textarea
              name="message"
              required
              rows={4}
              maxLength={2000}
              placeholder="Describe the issue in detail..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? 'Submitting…' : 'Submit ticket'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError('') }}
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
