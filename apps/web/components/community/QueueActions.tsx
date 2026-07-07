'use client'

import { useState } from 'react'

type Result = { error?: string } | { success?: boolean } | void

// Generic approve/reject buttons for the moderation queue. Takes bound server actions
// so it works for any pending item type (join requests, reviews, …). Mirrors the
// in-place "Done" pattern used by the bulletin/knowledge mod-action components.
export default function QueueActions({
  approve,
  reject,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
}: {
  approve: () => Promise<Result>
  reject: () => Promise<Result>
  approveLabel?: string
  rejectLabel?: string
}) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  if (done) return <span className="text-xs text-stone-400">Done</span>

  async function handle(action: 'approve' | 'reject', fn: () => Promise<Result>) {
    setLoading(action)
    setError('')
    const result = await fn()
    setLoading(null)
    if (result && 'error' in result && result.error) setError(result.error)
    else setDone(true)
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={() => handle('approve', approve)}
        disabled={!!loading}
        className="text-xs px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full font-medium transition-colors disabled:opacity-50"
      >
        {loading === 'approve' ? '…' : approveLabel}
      </button>
      <button
        onClick={() => handle('reject', reject)}
        disabled={!!loading}
        className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full font-medium transition-colors disabled:opacity-50"
      >
        {loading === 'reject' ? '…' : rejectLabel}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
