'use client'

import { useState } from 'react'
import { toggleAcceptAnswer } from '@/app/actions/knowledge'

type Props = {
  answerId: string
  questionId: string
  communityId: string
  slug: string
  isAccepted: boolean
}

export default function AcceptAnswerButton({ answerId, questionId, communityId, slug, isAccepted }: Props) {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    await toggleAcceptAnswer(answerId, questionId, communityId, slug)
    setLoading(false)
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      title={isAccepted ? 'Remove accepted mark' : 'Mark as the accepted answer'}
      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${
        isAccepted
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
      }`}
    >
      {loading ? '…' : isAccepted ? '✓ Accepted' : 'Mark as accepted'}
    </button>
  )
}
