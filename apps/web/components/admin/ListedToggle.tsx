'use client'

import { useTransition } from 'react'
import { toggleCommunityListed } from '@/app/actions/admin'

export default function ListedToggle({
  communityId,
  isListed,
}: {
  communityId: string
  isListed: boolean
}) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(() => toggleCommunityListed(communityId, !isListed))
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
        isListed
          ? 'bg-green-50 text-green-700 hover:bg-green-100'
          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
      }`}
    >
      {pending ? '...' : isListed ? 'Listed' : 'Unlisted'}
    </button>
  )
}
