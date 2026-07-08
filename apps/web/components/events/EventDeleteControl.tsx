'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteEvent } from '@/app/actions/events'

// Delete control for an event. A one-off event gets a plain Delete button; an
// event that belongs to a recurring series gets a small menu (this occurrence /
// this and future / whole series).
export default function EventDeleteControl({
  eventId,
  communityId,
  isSeries,
}: {
  eventId: string
  communityId: string
  isSeries: boolean
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function run(scope: 'one' | 'future' | 'series', confirmMsg: string) {
    if (!window.confirm(confirmMsg)) return
    setOpen(false)
    setError('')
    startTransition(async () => {
      const result = await deleteEvent(eventId, communityId, scope)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  if (!isSeries) {
    return (
      <span>
        <button
          onClick={() => run('one', 'Delete this event?')}
          disabled={pending}
          className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50 transition-colors"
        >
          {pending ? '…' : 'Delete'}
        </button>
        {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
      </span>
    )
  }

  return (
    <span className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={pending}
        className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50 transition-colors"
      >
        {pending ? '…' : 'Delete ▾'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-stone-200 bg-white py-1 shadow-lg text-sm">
            <button
              onClick={() => run('one', 'Delete just this occurrence?')}
              className="block w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50"
            >
              This event only
            </button>
            <button
              onClick={() => run('future', 'Delete this and all future occurrences, and stop it repeating?')}
              className="block w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50"
            >
              This and all following
            </button>
            <button
              onClick={() => run('series', 'Delete the entire series, including past occurrences?')}
              className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
            >
              Entire series
            </button>
          </div>
        </>
      )}
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </span>
  )
}
