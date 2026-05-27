'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useInvite } from '@/app/actions/invites'

export default function JoinViaInviteButton({
  token,
  label,
  slug,
  joinMode,
}: {
  token: string
  label: string
  slug: string
  joinMode: string
}) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleJoin() {
    setError('')
    startTransition(async () => {
      const result = await useInvite(token)
      if (result.error) {
        setError(result.error)
      } else if (result.status === 'active') {
        router.push(`/communities/${result.slug}`)
      } else {
        // pending
        setError('')
        router.push(`/communities/${slug}`)
      }
    })
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleJoin}
        disabled={pending}
        className="w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {pending ? 'Joining…' : label}
      </button>
      {joinMode !== 'open' && (
        <p className="text-xs text-stone-400">Your request will need to be approved by a moderator.</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
