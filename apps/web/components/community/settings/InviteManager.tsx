'use client'

import { useState, useTransition } from 'react'
import { createInvite, revokeInvite } from '@/app/actions/invites'

type Invite = {
  id: string
  token: string
  max_uses: number | null
  use_count: number
  expires_at: string | null
  created_at: string
}

export default function InviteManager({
  communityId,
  slug,
  baseUrl,
  initialInvites,
}: {
  communityId: string
  slug: string
  baseUrl: string
  initialInvites: Invite[]
}) {
  const [invites, setInvites] = useState(initialInvites)
  const [showForm, setShowForm] = useState(false)
  const [maxUses, setMaxUses] = useState('')
  const [expiresIn, setExpiresIn] = useState('7d')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleCreate() {
    startTransition(async () => {
      const result = await createInvite(
        communityId,
        slug,
        maxUses ? parseInt(maxUses) : null,
        expiresIn || null,
      )
      if (result.token) {
        setInvites(prev => [{
          id: crypto.randomUUID(),
          token: result.token!,
          max_uses: maxUses ? parseInt(maxUses) : null,
          use_count: 0,
          expires_at: null,
          created_at: new Date().toISOString(),
        }, ...prev])
        setShowForm(false)
        setMaxUses('')
        setExpiresIn('7d')
      }
    })
  }

  function handleRevoke(inviteId: string) {
    startTransition(async () => {
      await revokeInvite(inviteId, slug)
      setInvites(prev => prev.filter(i => i.id !== inviteId))
    })
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${baseUrl}/invite/${token}`)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  return (
    <div className="space-y-4">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="text-sm text-orange-600 hover:underline font-medium"
        >
          + Generate invite link
        </button>
      ) : (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Max uses (optional)</label>
              <input
                type="number"
                min="1"
                value={maxUses}
                onChange={e => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Expires</label>
              <select
                value={expiresIn}
                onChange={e => setExpiresIn(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Never</option>
                <option value="1d">1 day</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={pending}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {pending ? 'Creating…' : 'Create link'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div className="space-y-2">
          {invites.map(invite => {
            const expired = invite.expires_at && new Date(invite.expires_at) < new Date()
            const exhausted = invite.max_uses !== null && invite.use_count >= invite.max_uses
            const inactive = expired || exhausted

            return (
              <div key={invite.id} className={`flex items-center gap-3 rounded-xl border p-3 ${inactive ? 'border-stone-100 bg-stone-50 opacity-60' : 'border-stone-200 bg-white'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-stone-600 truncate">{baseUrl}/invite/{invite.token}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {invite.use_count}{invite.max_uses !== null ? `/${invite.max_uses}` : ''} uses
                    {invite.expires_at && ` · expires ${new Date(invite.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    {expired && ' · expired'}
                    {exhausted && ' · exhausted'}
                  </p>
                </div>
                <button
                  onClick={() => copyLink(invite.token)}
                  className="text-xs px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors shrink-0"
                >
                  {copiedToken === invite.token ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => handleRevoke(invite.id)}
                  disabled={pending}
                  className="text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            )
          })}
        </div>
      )}

      {invites.length === 0 && !showForm && (
        <p className="text-sm text-stone-400">No active invite links.</p>
      )}
    </div>
  )
}
