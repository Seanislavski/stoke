'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent, updateEvent, countEventChangeRecipients } from '@/app/actions/events'
import PhotoUploader from '@/components/PhotoUploader'
import {
  COMMON_TIMEZONES,
  wallTimeToUtcIso,
  formatEventDate,
  formatEventTime,
  tzAbbrev,
} from '@/lib/eventTime'

type LocationType = 'online' | 'in_person' | 'hybrid'

// What the edit form starts from. Times are wall-clock strings in `tz`.
export type EventFormInitial = {
  eventId: string
  title: string
  description: string | null
  startWall: string
  endWall: string
  tz: string
  startsAt: string        // the stored instants, to tell whether the time changed
  endsAt: string | null
  locationType: LocationType
  locationOnline: string | null
  locationAddress: string | null
  photos: string[]
  isSeries: boolean
}

const inputCls = 'w-full px-3 py-2 text-sm text-stone-900 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300'

// Create and edit share one form. In edit mode, a save that changes the time or
// location first says how many RSVP'd members will be notified and asks to confirm.
export default function EventForm({
  communityId,
  defaultTz,
  initial,
  onDone,
}: {
  communityId: string
  defaultTz: string           // the person's own profile zone
  initial?: EventFormInitial  // present = edit mode
  onDone: () => void
}) {
  const editing = !!initial
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [startWall, setStartWall] = useState(initial?.startWall ?? '')
  const [endWall, setEndWall] = useState(initial?.endWall ?? '')
  const [tz, setTz] = useState(initial?.tz ?? defaultTz)
  const [locationType, setLocationType] = useState<LocationType>(initial?.locationType ?? 'online')
  const [locationOnline, setLocationOnline] = useState(initial?.locationOnline ?? '')
  const [locationAddress, setLocationAddress] = useState(initial?.locationAddress ?? '')
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? [])
  const [repeat, setRepeat] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none')
  const [endType, setEndType] = useState<'count' | 'until' | 'never'>('never')
  const [scope, setScope] = useState<'one' | 'future'>('one')
  // Set when the editor must confirm notifying people; holds the count shown.
  const [confirmCount, setConfirmCount] = useState<number | null>(null)

  // Always offer the person's own zone and the event's zone, even if neither is
  // in the curated list.
  const zoneOptions = useMemo(() => {
    const opts = [...COMMON_TIMEZONES]
    for (const z of [defaultTz, initial?.tz]) {
      if (z && !opts.some(o => o.value === z)) opts.unshift({ value: z, label: z.replace(/_/g, ' ') })
    }
    return opts
  }, [defaultTz, initial?.tz])

  // Echo the time back so the organizer can check it before saving.
  const preview = useMemo(() => {
    if (!startWall) return null
    try {
      const s = wallTimeToUtcIso(startWall, tz)
      const e = endWall ? wallTimeToUtcIso(endWall, tz) : null
      const main = `${formatEventDate(s, tz)} · ${formatEventTime(s, tz)}${e ? ` – ${formatEventTime(e, tz)}` : ''} ${tzAbbrev(s, tz)}`
      const yours = tz !== defaultTz
        ? `${formatEventDate(s, defaultTz)} · ${formatEventTime(s, defaultTz)} ${tzAbbrev(s, defaultTz)}`
        : null
      return { main, yours }
    } catch {
      return null
    }
  }, [startWall, endWall, tz, defaultTz])

  // Same test the server uses: did the edited occurrence's time or place change?
  function timeOrPlaceChanged(): boolean {
    if (!initial) return false
    const s = wallTimeToUtcIso(startWall, tz)
    const e = endWall ? wallTimeToUtcIso(endWall, tz) : null
    const same = (a: string | null, b: string | null) =>
      (!a || !b) ? !a && !b : new Date(a).getTime() === new Date(b).getTime()
    const online = locationType === 'in_person' ? null : (locationOnline || null)
    const address = locationType === 'online' ? null : (locationAddress || null)
    return !same(initial.startsAt, s) || !same(initial.endsAt, e)
      || initial.locationType !== locationType
      || (initial.locationOnline ?? null) !== online
      || (initial.locationAddress ?? null) !== address
  }

  function validate(formData: FormData): string | null {
    if (!startWall) return 'Choose a start time.'
    if (endWall && new Date(wallTimeToUtcIso(endWall, tz)) <= new Date(wallTimeToUtcIso(startWall, tz))) {
      return 'End time must be after start time.'
    }
    if (!editing && repeat !== 'none' && endType === 'count') {
      const n = parseInt((formData.get('repeat_count') as string) || '', 10)
      if (!n || n < 1) return 'Enter how many times the event should repeat.'
    }
    if (!editing && repeat !== 'none' && endType === 'until') {
      const until = formData.get('repeat_until') as string
      if (!until || until < startWall.split('T')[0]) return 'Choose an end date on or after the first event.'
    }
    return null
  }

  function save(formData: FormData) {
    formData.set('photos', JSON.stringify(photos))
    formData.set('tz', tz)
    startTransition(async () => {
      if (initial) {
        const result = await updateEvent(initial.eventId, communityId, scope, formData)
        if (result.error) { setError(result.error); setConfirmCount(null); return }
      } else {
        await createEvent(communityId, formData)
      }
      onDone()
      router.refresh()
    })
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    const problem = validate(formData)
    if (problem) { setError(problem); return }

    if (initial && confirmCount === null && timeOrPlaceChanged()) {
      startTransition(async () => {
        const { count, error: err } = await countEventChangeRecipients(initial.eventId, communityId, scope)
        if (err) { setError(err); return }
        if (count > 0) setConfirmCount(count)
        else save(formData)
      })
      return
    }
    save(formData)
  }

  function confirmAndSave() {
    if (formRef.current) save(new FormData(formRef.current))
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="p-5 space-y-4">
      {initial?.isSeries && (
        <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 space-y-1.5">
          <p className="text-xs font-medium text-stone-600">This event repeats. Apply changes to:</p>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="radio" checked={scope === 'one'} onChange={() => { setScope('one'); setConfirmCount(null) }} className="accent-orange-500" />
            This event only
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="radio" checked={scope === 'future'} onChange={() => { setScope('future'); setConfirmCount(null) }} className="accent-orange-500" />
            This and all following
          </label>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Title *</label>
        <input name="title" required defaultValue={initial?.title} className={inputCls} placeholder="Event title" />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ''}
          className={`${inputCls} resize-none`}
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
            value={startWall}
            onChange={e => { setStartWall(e.target.value); setConfirmCount(null) }}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Ends</label>
          <input
            name="ends_at"
            type="datetime-local"
            value={endWall}
            onChange={e => { setEndWall(e.target.value); setConfirmCount(null) }}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Time zone</label>
        <select
          value={tz}
          onChange={e => { setTz(e.target.value); setConfirmCount(null) }}
          className={inputCls}
        >
          {zoneOptions.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}{o.value === defaultTz ? ' (yours)' : ''}
            </option>
          ))}
        </select>
        {preview && (
          <p className="mt-1.5 text-xs text-stone-500">
            🕒 {preview.main}
            {preview.yours && <> · that&apos;s <span className="font-medium">{preview.yours}</span> for you</>}
          </p>
        )}
        <p className="mt-0.5 text-xs text-stone-400">Members see this converted to their own time zone.</p>
      </div>

      {!editing && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Repeats</label>
          <select
            name="repeat_frequency"
            value={repeat}
            onChange={e => setRepeat(e.target.value as typeof repeat)}
            className={inputCls}
          >
            <option value="none">Doesn&apos;t repeat</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>

          {repeat !== 'none' && (
            <div className="mt-3 rounded-lg bg-stone-50 border border-stone-200 p-3 space-y-2">
              <p className="text-xs font-medium text-stone-600">Ends</p>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="radio" name="repeat_end_type" value="never" checked={endType === 'never'} onChange={() => setEndType('never')} className="accent-orange-500" />
                Until I turn it off
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="radio" name="repeat_end_type" value="count" checked={endType === 'count'} onChange={() => setEndType('count')} className="accent-orange-500" />
                After
                <input
                  name="repeat_count"
                  type="number"
                  min={1}
                  max={520}
                  defaultValue={12}
                  disabled={endType !== 'count'}
                  className="w-16 px-2 py-1 text-sm text-stone-900 border border-stone-200 rounded disabled:opacity-40"
                />
                times
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="radio" name="repeat_end_type" value="until" checked={endType === 'until'} onChange={() => setEndType('until')} className="accent-orange-500" />
                On date
                <input
                  name="repeat_until"
                  type="date"
                  disabled={endType !== 'until'}
                  className="px-2 py-1 text-sm text-stone-900 border border-stone-200 rounded disabled:opacity-40"
                />
              </label>
            </div>
          )}
        </div>
      )}

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
                onChange={() => { setLocationType(lt); setConfirmCount(null) }}
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
            value={locationOnline}
            onChange={e => { setLocationOnline(e.target.value); setConfirmCount(null) }}
            className={inputCls}
            placeholder="https://zoom.us/j/..."
          />
        </div>
      )}

      {(locationType === 'in_person' || locationType === 'hybrid') && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Address</label>
          <input
            name="location_address"
            value={locationAddress}
            onChange={e => { setLocationAddress(e.target.value); setConfirmCount(null) }}
            className={inputCls}
            placeholder="123 Main St, City, State"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">Photos</label>
        <PhotoUploader photos={photos} onChange={setPhotos} pathPrefix={`community-photos/events-${communityId}`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {confirmCount !== null ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">
              {confirmCount === 1 ? '1 person' : `${confirmCount} people`} who RSVP&apos;d will be told about this change
            </span>{' '}
            with a notification and an email.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmCount(null)}
              className="px-3 py-1.5 text-sm text-stone-600 hover:bg-white rounded-lg border border-stone-200"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={confirmAndSave}
              disabled={pending}
              className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save and notify'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 rounded-lg border border-stone-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {pending ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save changes' : 'Create event')}
          </button>
        </div>
      )}
    </form>
  )
}
