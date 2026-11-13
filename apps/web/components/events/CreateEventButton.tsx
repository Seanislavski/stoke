'use client'

import { useState } from 'react'
import EventForm from './EventForm'

export default function CreateEventButton({ communityId, defaultTz }: { communityId: string; defaultTz: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
      >
        + Create event
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <h2 className="text-lg font-semibold text-stone-900">Create event</h2>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
            </div>
            {/* Unmounting on close resets the form for next time. */}
            <EventForm communityId={communityId} defaultTz={defaultTz} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
