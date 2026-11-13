'use client'

import { useState } from 'react'
import EventForm from './EventForm'
import { utcIsoToWall } from '@/lib/eventTime'

type LocationType = 'online' | 'in_person' | 'hybrid'

export default function EventEditButton({
  communityId,
  event,
  defaultTz,
  eventTz,
}: {
  communityId: string
  event: {
    id: string
    title: string
    description: string | null
    starts_at: string
    ends_at: string | null
    location_type: string
    location_online: string | null
    location_address: string | null
    photos: string[] | null
    series_id: string | null
  }
  defaultTz: string   // the editor's own zone
  eventTz: string     // the zone the form opens in (a series' own zone, else the editor's)
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-stone-400 hover:text-orange-600 transition-colors"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <h2 className="text-lg font-semibold text-stone-900">Edit event</h2>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
            </div>
            <EventForm
              communityId={communityId}
              defaultTz={defaultTz}
              onDone={() => setOpen(false)}
              initial={{
                eventId: event.id,
                title: event.title,
                description: event.description,
                startWall: utcIsoToWall(event.starts_at, eventTz),
                endWall: event.ends_at ? utcIsoToWall(event.ends_at, eventTz) : '',
                tz: eventTz,
                startsAt: event.starts_at,
                endsAt: event.ends_at,
                locationType: (['online', 'in_person', 'hybrid'].includes(event.location_type) ? event.location_type : 'online') as LocationType,
                locationOnline: event.location_online,
                locationAddress: event.location_address,
                photos: event.photos ?? [],
                isSeries: !!event.series_id,
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
