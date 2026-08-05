'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { castVote } from '@/app/actions/contests'

type Props = {
  contestId: string
  entryId: string
  /** True when this is the entry the viewer currently has their vote on. */
  isMyVote: boolean
  canVote: boolean
}

export default function VoteButton({ contestId, entryId, isMyVote, canVote }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  if (!canVote) return null

  async function handleVote() {
    if (isMyVote) return
    setLoading(true)
    setError('')
    const result = await castVote(contestId, entryId)
    setLoading(false)
    if (result.error) setError(result.error)
    else router.refresh()
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleVote}
        disabled={loading || isMyVote}
        className={`w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-70 ${
          isMyVote
            ? 'bg-orange-100 text-orange-700 cursor-default'
            : 'bg-orange-500 hover:bg-orange-600 text-white'
        }`}
      >
        {loading ? '…' : isMyVote ? '✓ Your vote' : 'Vote for this'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
