'use client'

import { useState } from 'react'
import { createKbCategory, deleteKbCategory } from '@/app/actions/knowledge'

type Category = { id: string; name: string; description: string | null }
type Props = { communityId: string; slug: string; initialCategories: Category[] }

export default function CategoryManager({ communityId, slug, initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const formData = new FormData(form)
    const result = await createKbCategory(communityId, slug, formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      const name = (formData.get('name') as string).trim()
      const description = ((formData.get('description') as string) || '').trim() || null
      setCategories(prev => [...prev, { id: crypto.randomUUID(), name, description }])
      setAdding(false)
      form.reset()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category? Questions filed under it become uncategorized.')) return
    setCategories(prev => prev.filter(c => c.id !== id))
    await deleteKbCategory(id, communityId, slug)
  }

  return (
    <div className="space-y-3">
      {categories.length > 0 ? (
        <div className="border border-stone-200 rounded-lg divide-y divide-stone-100">
          {categories.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800">{c.name}</p>
                {c.description && <p className="text-xs text-stone-400">{c.description}</p>}
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="text-xs text-stone-400 hover:text-red-600 shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-400">No categories yet. Add a few so members can browse questions by topic.</p>
      )}

      {adding ? (
        <form onSubmit={handleAdd} className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2">
          <input
            name="name"
            type="text"
            required
            maxLength={60}
            placeholder="Category name (e.g. Focus techniques)"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
          <input
            name="description"
            type="text"
            maxLength={120}
            placeholder="Short description (optional)"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {loading ? '…' : 'Add category'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError('') }} className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-orange-600 hover:underline font-medium">
          + Add category
        </button>
      )}
    </div>
  )
}
