'use client'

import { useState } from 'react'
import { approveQuestion, rejectQuestion } from '@/app/actions/knowledge'

type Category = { id: string; name: string }
type Props = { questionId: string; communityId: string; slug: string; categories: Category[] }

export default function QuestionModActions({ questionId, communityId, slug, categories }: Props) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [done, setDone] = useState(false)
  const [categoryId, setCategoryId] = useState('')

  if (done) return <span className="text-xs text-stone-400">Done</span>

  async function handle(action: 'approve' | 'reject') {
    setLoading(action)
    const result = action === 'approve'
      ? await approveQuestion(questionId, communityId, slug, categoryId || null)
      : await rejectQuestion(questionId, communityId, slug)
    setLoading(null)
    if (!result.error) setDone(true)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {categories.length > 0 && (
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="text-xs px-2 py-1 border border-stone-300 rounded-lg text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="">Uncategorized</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <button
        onClick={() => handle('approve')}
        disabled={!!loading}
        className="text-xs px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full font-medium transition-colors disabled:opacity-50"
      >
        {loading === 'approve' ? '…' : 'Approve'}
      </button>
      <button
        onClick={() => handle('reject')}
        disabled={!!loading}
        className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full font-medium transition-colors disabled:opacity-50"
      >
        {loading === 'reject' ? '…' : 'Reject'}
      </button>
    </div>
  )
}
