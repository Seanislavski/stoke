'use client'

import { useState, useEffect, useRef } from 'react'
import { joinCommunity, leaveCommunity } from '@/app/actions/membership'

type Props = {
  communityId: string
  joinMode: string
  slug: string
  memberStatus: string | null  // null = not a member
  isOwner: boolean
  role?: string | null  // viewer's community role (organizer | moderator | member)
}

function RoleBadge({ label }: { label: string }) {
  return (
    <span className="text-xs text-stone-400 font-medium uppercase tracking-wide whitespace-nowrap">
      {label}
    </span>
  )
}

export default function JoinButton({ communityId, joinMode, slug, memberStatus, isOwner, role = null }: Props) {
  const [loading, setLoading] = useState(false)
  const [localStatus, setLocalStatus] = useState(memberStatus)
  const [error, setError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!error) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setError(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [error])

  // Community owners can't leave, so they get a badge and no action.
  if (isOwner) return <RoleBadge label="Owner" />

  if (joinMode === 'invite_only' && !localStatus) return null

  async function handleJoin() {
    setLoading(true)
    setError(null)
    const result = await joinCommunity(communityId, joinMode, slug)
    if (result.error) setError(result.error)
    else setLocalStatus(result.status ?? null)
    setLoading(false)
  }

  async function handleLeave() {
    setLoading(true)
    const result = await leaveCommunity(communityId, slug)
    if (!result.error) setLocalStatus(null)
    setLoading(false)
  }

  // Staff roles get an accurate badge alongside their Leave action.
  const roleLabel = localStatus === 'active'
    ? (role === 'organizer' ? 'Organizer' : role === 'moderator' ? 'Moderator' : null)
    : null

  if (localStatus === 'active') {
    return (
      <div className="flex items-center gap-2">
        {roleLabel && <RoleBadge label={roleLabel} />}
        <button
          onClick={handleLeave}
          disabled={loading}
          className="px-4 py-1.5 text-sm border border-stone-300 text-stone-600 rounded-lg hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          {loading ? '…' : 'Leave'}
        </button>
      </div>
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
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={handleJoin}
        disabled={loading}
        className="px-4 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '…' : joinMode === 'request' ? 'Request to join' : 'Join'}
      </button>
      {error && (
        <p className="absolute top-full mt-1 right-0 text-xs text-red-600 bg-white border border-red-200 rounded px-2 py-1 w-56 text-right shadow-sm z-10">
          {error}
        </p>
      )}
    </div>
  )
}
