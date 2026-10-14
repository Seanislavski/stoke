'use client'

import { useState } from 'react'
import { setFollow } from '@/app/actions/follows'

type Props = {
  kind: 'question' | 'story'
  targetId: string
  communityId: string
  initialOn: boolean
}

export default function FollowButton({ kind, targetId, communityId, initialOn }: Props) {
  const [on, setOn] = useState(initialOn)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle() {
    setLoading(true)
    setError(null)
    const res = await setFollow(kind, targetId, communityId, !on)
    if (res.error) setError(res.error)
    else setOn(!!res.on)
    setLoading(false)
  }

  const what = kind === 'question' ? 'new answers' : 'new replies'
  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handle}
        disabled={loading}
        title={on ? `Stop notifying me about ${what}` : `Notify me about ${what}`}
        className={`text-xs px-3 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${
          on
            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
        }`}
      >
        {loading ? '…' : on ? '🔔 Following' : '🔕 Follow'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  )
}
