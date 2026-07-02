'use client'

import { useState } from 'react'
import { setQuestionCategory } from '@/app/actions/knowledge'

type Category = { id: string; name: string }
type Props = {
  questionId: string
  communityId: string
  slug: string
  categories: Category[]
  currentCategoryId: string | null
}

export default function QuestionCategoryPicker({ questionId, communityId, slug, categories, currentCategoryId }: Props) {
  const [categoryId, setCategoryId] = useState(currentCategoryId ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (categories.length === 0) return null

  async function handleChange(next: string) {
    const prev = categoryId
    setCategoryId(next)
    setSaved(false)
    setSaving(true)
    const result = await setQuestionCategory(questionId, communityId, slug, next || null)
    setSaving(false)
    if (result.error) {
      setCategoryId(prev) // revert on failure
    } else {
      setSaved(true)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <label className="text-xs text-stone-400">Category</label>
      <select
        value={categoryId}
        onChange={e => handleChange(e.target.value)}
        disabled={saving}
        className="text-xs px-2 py-1 border border-stone-300 rounded-lg text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
      >
        <option value="">Uncategorized</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {saving && <span className="text-xs text-stone-400">Saving…</span>}
      {saved && !saving && <span className="text-xs text-green-600">Saved</span>}
    </div>
  )
}
