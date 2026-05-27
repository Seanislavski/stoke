'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertRsvp } from '@/app/actions/events'

const OPTIONS = [
  { value: 'yes', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: "Can't go" },
] as const

export default function RsvpButton({
  eventId,
  communityId,
  currentStatus,
}: {
  eventId: string
  communityId: string
  currentStatus: string | null
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick(value: string) {
    // clicking active status clears it
    const next = value === currentStatus ? null : value
    startTransition(async () => {
      await upsertRsvp(eventId, communityId, next)
      router.refresh()
    })
  }

  return (
    <div className="flex gap-1.5">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleClick(value)}
          disabled={pending}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            currentStatus === value
              ? value === 'yes'
                ? 'bg-green-500 text-white'
                : value === 'maybe'
                ? 'bg-amber-400 text-white'
                : 'bg-stone-400 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
