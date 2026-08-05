'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setContestStatus, setWinner, deleteContest } from '@/app/actions/contests'
import { ALLOWED_TRANSITIONS, CONTEST_STATUS_LABELS, type ContestStatus } from '@/lib/contests'

type Finalist = { id: string; title: string }

type Props = {
  contestId: string
  slug: string
  status: ContestStatus
  finalists: Finalist[]
  winnerEntryId: string | null
}

const NEXT_LABEL: Record<string, string> = {
  submissions: 'Open for entries',
  voting: 'Open voting',
  closed: 'Close contest',
  draft: 'Back to draft',
}

export default function ContestPhaseControls({ contestId, slug, status, finalists, winnerEntryId }: Props) {
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

  const moves = ALLOWED_TRANSITIONS[status] ?? []

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
          Organizer controls
        </p>
        <span className="text-xs text-stone-500">
          Phase: <span className="font-medium text-stone-700">{CONTEST_STATUS_LABELS[status]}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {moves.map(next => (
          <button
            key={next}
            onClick={() => run(next, () => setContestStatus(contestId, next))}
            disabled={!!loading}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              next === 'draft' || next === 'submissions'
                ? 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {loading === next ? '…' : NEXT_LABEL[next] ?? next}
          </button>
        ))}
      </div>

      {status === 'closed' && (
        <div className="border-t border-stone-200 pt-3">
          <label className="block text-xs font-medium text-stone-600 mb-1.5">Winner</label>
          {finalists.length === 0 ? (
            <p className="text-xs text-stone-400">No finalists were marked, so there&apos;s nobody to pick.</p>
          ) : (
            <select
              value={winnerEntryId ?? ''}
              disabled={!!loading}
              onChange={e => run('winner', () => setWinner(contestId, e.target.value || null))}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="">No winner set</option>
              {finalists.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          )}
          <p className="text-xs text-stone-400 mt-1.5">
            Setting a winner notifies the entrant by bell and email.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="border-t border-stone-200 pt-3">
        <button
          onClick={() => {
            if (!confirm('Delete this contest and every entry in it? This cannot be undone.')) return
            setLoading('delete')
            void deleteContest(contestId).then(result => {
              setLoading(null)
              if (result.error) setError(result.error)
              else router.push(`/communities/${slug}?tab=contests`)
            })
          }}
          disabled={!!loading}
          className="text-xs text-stone-400 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {loading === 'delete' ? '…' : 'Delete contest'}
        </button>
      </div>
    </div>
  )
}
