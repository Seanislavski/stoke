'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitEntry, editEntry } from '@/app/actions/contests'
import PhotoUploader from '@/components/PhotoUploader'

type Props = {
  contestId: string
  terms: string
  /** Present when editing an existing entry rather than creating one. */
  entry?: { id: string; title: string; description: string | null; photos: string[] }
}

export default function SubmitEntryForm({ contestId, terms, entry }: Props) {
  const isEdit = !!entry
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<string[]>(entry?.photos ?? [])
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    formData.set('photos', JSON.stringify(photos))
    const result = isEdit
      ? await editEntry(entry.id, formData)
      : await submitEntry(contestId, formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setOpen(false)
    if (!isEdit) setPhotos([])
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={isEdit
          ? 'text-xs text-stone-500 hover:text-orange-600 underline'
          : 'px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors'}
      >
        {isEdit ? 'Edit your entry' : 'Enter your design'}
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
      <input
        name="title"
        type="text"
        required
        maxLength={120}
        defaultValue={entry?.title ?? ''}
        placeholder="Give your design a name"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />
      <textarea
        name="description"
        rows={3}
        maxLength={1000}
        defaultValue={entry?.description ?? ''}
        placeholder="Anything you'd like to say about it (optional)"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
      />

      <div>
        <p className="text-xs font-medium text-stone-600 mb-1.5">Your design</p>
        <PhotoUploader
          photos={photos}
          onChange={setPhotos}
          pathPrefix={`community-photos/contest-${contestId}`}
        />
        <p className="text-xs text-stone-400 mt-1.5">At least one image is required.</p>
      </div>

      {/* The licence grant. Required on create; on edit it was already recorded,
          so we show it as a reminder rather than asking again. */}
      {isEdit ? (
        <p className="text-xs text-stone-400 border-t border-stone-200 pt-3">
          Your original agreement to the entry terms still applies.
        </p>
      ) : (
        <label className="flex items-start gap-2 text-xs text-stone-600 cursor-pointer border-t border-stone-200 pt-3">
          <input type="checkbox" name="agree_terms" required className="mt-0.5 h-3.5 w-3.5 accent-orange-500 shrink-0" />
          <span>{terms}</span>
        </label>
      )}

      {!isEdit && (
        <p className="text-xs text-stone-400">
          Entries are reviewed by an organizer, and stay hidden from other members until voting opens.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? '…' : isEdit ? 'Save changes' : 'Submit entry'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError('') }}
          className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
