'use client'

import { useState, useTransition } from 'react'
import { addTicketCategory, deleteTicketCategory, toggleTicketCategory } from '@/app/actions/categories'
import type { TicketCategory } from '@/lib/ticket-categories'

export default function CategoryManager({ categories }: { categories: TicketCategory[] }) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    const form = e.currentTarget
    startTransition(async () => {
      const result = await addTicketCategory(formData)
      if (result.error) {
        setError(result.error)
      } else {
        form.reset()
      }
    })
  }

  function handleDelete(key: string) {
    if (!confirm(`Delete category "${key}"? Existing tickets with this category will still show it.`)) return
    startTransition(async () => {
      const result = await deleteTicketCategory(key)
      if (result.error) setError(result.error)
    })
  }

  function handleToggle(key: string, current: boolean) {
    startTransition(async () => {
      await toggleTicketCategory(key, !current)
    })
  }

  return (
    <div className="mt-10 border-t border-stone-200 pt-8">
      <h2 className="text-sm font-semibold text-stone-700 mb-4">Ticket Categories</h2>

      <div className="space-y-2 mb-5">
        {categories.map(cat => (
          <div
            key={cat.key}
            className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm text-stone-900">{cat.label}</span>
              <span className="ml-2 text-xs text-stone-400 font-mono">{cat.key}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'}`}>
              {cat.is_active ? 'Active' : 'Hidden'}
            </span>
            <button
              onClick={() => handleToggle(cat.key, cat.is_active)}
              disabled={pending}
              title={cat.is_active ? 'Hide from new tickets' : 'Show in new tickets'}
              className="text-xs text-stone-400 hover:text-stone-700 disabled:opacity-40 transition-colors px-1"
            >
              {cat.is_active ? '👁' : '👁‍🗨'}
            </button>
            <button
              onClick={() => handleDelete(cat.key)}
              disabled={pending}
              title="Delete category"
              className="text-xs text-stone-300 hover:text-red-500 disabled:opacity-40 transition-colors px-1"
            >
              ✕
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-stone-400">No categories yet.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            name="label"
            required
            maxLength={60}
            placeholder="New category name"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0"
        >
          Add
        </button>
      </form>
      <p className="text-xs text-stone-400 mt-2">
        The key is auto-generated from the label. Deleting a category won't affect existing tickets.
      </p>
    </div>
  )
}
