'use client'

import { useState } from 'react'
import { approvePost, rejectPost } from '@/app/actions/bulletin'

type Props = { postId: string; communityId: string; slug: string }

export default function ModActions({ postId, communityId, slug }: Props) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [done, setDone] = useState(false)

  if (done) return <span className="text-xs text-stone-400">Done</span>

  async function handle(action: 'approve' | 'reject') {
    setLoading(action)
    const result = action === 'approve'
      ? await approvePost(postId, communityId, slug)
      : await rejectPost(postId, communityId, slug)
    setLoading(null)
    if (!result.error) setDone(true)
  }

  return (
    <div className="flex gap-2 mt-2">
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
