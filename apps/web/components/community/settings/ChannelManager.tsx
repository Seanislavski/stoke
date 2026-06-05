'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createChannel, deleteChannel } from '@/app/actions/channels'

type Channel = { id: string; name: string; description: string | null }

export default function ChannelManager({
  communityId,
  slug,
  initialChannels,
}: {
  communityId: string
  slug: string
  initialChannels: Channel[]
}) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleCreate(formData: FormData) {
    setSaving(true)
    setError('')
    const result = await createChannel(communityId, slug, formData)
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      // refetch is handled by revalidatePath; optimistically add
      const name = formData.get('name') as string
      const description = (formData.get('description') as string) || null
      setChannels(cs => [...cs, { id: Date.now().toString(), name, description }])
      setShowForm(false)
    }
  }

  async function handleDelete(channelId: string) {
    if (!confirm('Delete this channel and all its messages?')) return
    setDeleting(channelId)
    const result = await deleteChannel(channelId, slug)
    setDeleting(null)
    if (result.error) {
      setError(result.error)
    } else {
      setChannels(cs => cs.filter(c => c.id !== channelId))
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      {error && (
        <p className="text-sm text-red-600">
          {error}{' '}
          {error.includes('Upgrade your plan') && (
            <Link href="/settings/billing" className="inline-block mt-2 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors">Upgrade plan</Link>
          )}
        </p>
      )}

      {channels.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
          {channels.map(ch => (
            <div key={ch.id} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800"># {ch.name}</p>
                {ch.description && (
                  <p className="text-xs text-stone-400 truncate">{ch.description}</p>
                )}
              </div>
              <button
                disabled={deleting === ch.id}
                onClick={() => handleDelete(ch.id)}
                className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50 flex-shrink-0"
              >
                {deleting === ch.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form action={handleCreate} className="space-y-3 bg-stone-50 rounded-xl border border-stone-200 p-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Channel name</label>
            <input
              name="name"
              type="text"
              required
              maxLength={40}
              placeholder="e.g. general"
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Description (optional)</label>
            <input
              name="description"
              type="text"
              maxLength={100}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
            >
              {saving ? 'Creating…' : 'Create channel'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 border border-stone-300 hover:bg-stone-50 text-stone-600 text-xs rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm rounded-lg"
        >
          + Add channel
        </button>
      )}
    </div>
  )
}
