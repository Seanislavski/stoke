'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent } from '@/app/actions/events'

export default function CreateEventButton({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false)
  const [locationType, setLocationType] = useState<'online' | 'in_person' | 'hybrid'>('online')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const startsAt = formData.get('starts_at') as string
    const endsAt = formData.get('ends_at') as string
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      alert('End time must be after start time.')
      return
    }
    startTransition(async () => {
      await createEvent(communityId, formData)
      setOpen(false)
      formRef.current?.reset()
      setLocationType('online')
      router.refresh()
    })
  }

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

            <form ref={formRef} onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Title *</label>
                <input
                  name="title"
                  required
                  className="w-full px-3 py-2 text-sm text-stone-900 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                  placeholder="Event title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 text-sm text-stone-900 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                  placeholder="What's this event about?"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Starts *</label>
                  <input
                    name="starts_at"
                    type="datetime-local"
                    required
                    className="w-full px-3 py-2 text-sm text-stone-900 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Ends</label>
                  <input
                    name="ends_at"
                    type="datetime-local"
                    className="w-full px-3 py-2 text-sm text-stone-900 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Location type *</label>
                <div className="flex gap-3">
                  {(['online', 'in_person', 'hybrid'] as const).map(lt => (
                    <label key={lt} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="location_type"
                        value={lt}
                        checked={locationType === lt}
                        onChange={() => setLocationType(lt)}
                        className="accent-orange-500"
                      />
                      <span className="text-sm text-stone-700 capitalize">{lt.replace('_', '-')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {(locationType === 'online' || locationType === 'hybrid') && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Online link</label>
                  <input
                    name="location_online"
                    type="url"
                    className="w-full px-3 py-2 text-sm text-stone-900 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              )}

              {(locationType === 'in_person' || locationType === 'hybrid') && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Address</label>
                  <input
                    name="location_address"
                    className="w-full px-3 py-2 text-sm text-stone-900 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                    placeholder="123 Main St, City, State"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 rounded-lg border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {pending ? 'Creating...' : 'Create event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
