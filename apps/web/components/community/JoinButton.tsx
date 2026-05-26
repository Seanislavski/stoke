'use client'

import { useState } from 'react'
import { joinCommunity, leaveCommunity } from '@/app/actions/membership'

type Props = {
  communityId: string
  joinMode: string
  slug: string
  memberStatus: string | null  // null = not a member
  isOwner: boolean
}

export default function JoinButton({ communityId, joinMode, slug, memberStatus, isOwner }: Props) {
  const [loading, setLoading] = useState(false)
  const [localStatus, setLocalStatus] = useState(memberStatus)

  if (isOwner) return (
    <span className="text-xs text-stone-400 font-medium uppercase tracking-wide">Organizer</span>
  )

  if (joinMode === 'invite_only' && !localStatus) return null

  async function handleJoin() {
    setLoading(true)
    const result = await joinCommunity(communityId, joinMode, slug)
    if (!result.error) setLocalStatus(result.status ?? null)
    setLoading(false)
  }

  async function handleLeave() {
    setLoading(true)
    const result = await leaveCommunity(communityId, slug)
    if (!result.error) setLocalStatus(null)
    setLoading(false)
  }

  if (localStatus === 'active') {
    return (
      <button
        onClick={handleLeave}
        disabled={loading}
        className="px-4 py-1.5 text-sm border border-stone-300 text-stone-600 rounded-lg hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
      >
        {loading ? '…' : 'Leave'}
      </button>
    )
  }

  if (localStatus === 'pending') {
    return (
      <span className="px-4 py-1.5 text-sm border border-stone-200 text-stone-400 rounded-lg">
        Request pending
      </span>
    )
  }

  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className="px-4 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? '…' : joinMode === 'request' ? 'Request to join' : 'Join'}
    </button>
  )
}
