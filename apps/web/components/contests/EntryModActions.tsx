'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveEntry, rejectEntry, toggleFinalist, deleteEntry } from '@/app/actions/contests'

type Props = {
  entryId: string
  status: 'pending' | 'approved' | 'rejected'
  isFinalist: boolean
  /** Finalists are only meaningful once entries have closed. */
  showFinalist: boolean
}

export default function EntryModActions({ entryId, status, isFinalist, showFinalist }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  async function run(key: string, fn: () => Promise<{ error?: string }>) {
    setLoading(key)
    setError('')
    const result = await fn()
    setLoading(null)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {status !== 'approved' && (
          <button
            onClick={() => run('approve', () => approveEntry(entryId))}
            disabled={!!loading}
            className="text-xs px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full font-medium transition-colors disabled:opacity-50"
          >
            {loading === 'approve' ? '…' : 'Approve'}
          </button>
        )}
        {status !== 'rejected' && (
          <button
            onClick={() => run('reject', () => rejectEntry(entryId))}
            disabled={!!loading}
            className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full font-medium transition-colors disabled:opacity-50"
          >
            {loading === 'reject' ? '…' : 'Reject'}
          </button>
        )}
        {showFinalist && status === 'approved' && (
          <button
            onClick={() => run('finalist', () => toggleFinalist(entryId))}
            disabled={!!loading}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${
              isFinalist
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
            }`}
          >
            {loading === 'finalist' ? '…' : isFinalist ? '★ Finalist' : 'Make finalist'}
          </button>
        )}
        <button
          onClick={() => {
            if (!confirm('Delete this entry? This cannot be undone.')) return
            void run('delete', () => deleteEntry(entryId))
          }}
          disabled={!!loading}
          className="text-xs text-stone-400 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {loading === 'delete' ? '…' : 'Delete'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
