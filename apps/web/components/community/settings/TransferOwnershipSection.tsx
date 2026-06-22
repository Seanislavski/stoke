'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { transferOwnership } from '@/app/actions/community'

type Organizer = { user_id: string; username: string; display_name: string | null }

export default function TransferOwnershipSection({
  communityId,
  slug,
  communityName,
  organizers,
}: {
  communityId: string
  slug: string
  communityName: string
  organizers: Organizer[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = !!selected && confirmText.trim() === communityName && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    const r = await transferOwnership(communityId, slug, selected)
    if (r.error) {
      setError(r.error)
      setBusy(false)
      return
    }
    // Caller is no longer the owner — refresh re-renders the page without this section.
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
      <h3 className="text-sm font-semibold text-red-700">Transfer ownership</h3>
      <p className="mt-1 text-sm text-stone-600">
        Hand this community to another organizer. They become the owner — your plan stops governing its
        limits and theirs takes over. You stay on as an organizer. This can&apos;t be undone by you afterward.
      </p>

      {organizers.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">
          You have no other organizers yet. Promote a member to <span className="font-medium">Organizer</span> in
          the Members section above before you can transfer ownership.
        </p>
      ) : !open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 px-4 py-2 text-sm font-medium border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
        >
          Transfer ownership…
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">New owner</label>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              disabled={busy}
              className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              <option value="">Select an organizer…</option>
              {organizers.map(o => (
                <option key={o.user_id} value={o.user_id}>
                  {o.display_name ?? o.username} (@{o.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">
              Type <span className="font-semibold text-stone-800">{communityName}</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              disabled={busy}
              placeholder={communityName}
              className="w-full text-sm border border-stone-300 rounded-lg px-3 py-2 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? 'Transferring…' : 'Transfer ownership'}
            </button>
            <button
              onClick={() => { setOpen(false); setSelected(''); setConfirmText(''); setError('') }}
              disabled={busy}
              className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
