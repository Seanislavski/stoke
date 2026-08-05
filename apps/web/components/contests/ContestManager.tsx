'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createContest, setContestsEnabled } from '@/app/actions/contests'
import { CONTEST_STATUS_LABELS, type ContestStatus } from '@/lib/contests'

type Contest = { id: string; title: string; status: ContestStatus; created_at: string }

type Props = {
  communityId: string
  slug: string
  enabled: boolean
  contests: Contest[]
}

export default function ContestManager({ communityId, slug, enabled, contests }: Props) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function toggle() {
    const next = !isEnabled
    setIsEnabled(next)
    const result = await setContestsEnabled(communityId, slug, next)
    if (result.error) {
      setIsEnabled(!next)
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const formData = new FormData(e.currentTarget)
    // ⚠️ A datetime-local input yields a NAIVE string ("2026-09-01T00:00") with no
    // zone, which Postgres timestamptz then reads as UTC — so an organizer in ET
    // asking for midnight gets 8pm the previous evening. Convert through Date,
    // which interprets the naive string in the BROWSER's zone, to a real instant.
    // Matters especially here: submissions_close_at is enforced, not just displayed.
    const close = formData.get('submissions_close_at') as string
    if (close) formData.set('submissions_close_at', new Date(close).toISOString())
    const result = await createContest(communityId, slug, formData)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setOpen(false)
    if (result.contestId) router.push(`/communities/${slug}/contests/${result.contestId}`)
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={toggle}
          className="mt-0.5 h-4 w-4 accent-orange-500"
        />
        <span className="text-sm text-stone-700">
          Show a Contests tab in this community
          <span className="block text-xs text-stone-400">
            Run design competitions where members submit entries and vote on the finalists.
          </span>
        </span>
      </label>

      {isEnabled && (
        <>
          {contests.length > 0 && (
            <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
              {contests.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Link
                    href={`/communities/${slug}/contests/${c.id}`}
                    className="text-sm text-stone-800 hover:text-orange-600 truncate"
                  >
                    {c.title}
                  </Link>
                  <span className="text-xs text-stone-400 shrink-0">{CONTEST_STATUS_LABELS[c.status]}</span>
                </li>
              ))}
            </ul>
          )}

          {open ? (
            <form onSubmit={handleCreate} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
              <input
                name="title"
                required
                maxLength={120}
                placeholder="Contest name, e.g. Body Doubling merch design"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <textarea
                name="description"
                rows={3}
                maxLength={2000}
                placeholder="The brief — what are you asking people to design?"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
              <textarea
                name="rules"
                rows={2}
                maxLength={2000}
                placeholder="Rules or constraints (optional) — file formats, colours, anything to avoid"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-stone-500">
                  Entries close
                  <input
                    type="datetime-local"
                    name="submissions_close_at"
                    className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </label>
                <label className="text-xs text-stone-500">
                  Max entries per member
                  <input
                    type="number"
                    name="max_entries_per_member"
                    min={1}
                    defaultValue={1}
                    className="mt-1 w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </label>
              </div>
              <p className="text-xs text-stone-400">
                The contest starts as a draft — members won&apos;t see it until you open it for entries.
                Entrants agree to a standard licence granting the community permission to reproduce
                and sell the winning design, with credit.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? '…' : 'Create contest'}
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
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              New contest
            </button>
          )}
        </>
      )}

      {error && !open && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
