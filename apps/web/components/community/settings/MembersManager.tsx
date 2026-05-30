'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  updateMemberRole,
  removeMember,
  banMember,
  unbanMember,
  approveRequest,
  rejectRequest,
} from '@/app/actions/community'

type Member = {
  user_id: string
  role: string
  status: string
  profiles: { username: string; display_name: string | null } | null
}

type CallerRole = 'owner' | 'organizer' | 'moderator'

export default function MembersManager({
  communityId,
  slug,
  callerRole,
  callerId,
  initialMembers,
  platformStaffIds = [],
}: {
  communityId: string
  slug: string
  callerRole: CallerRole
  callerId: string
  initialMembers: Member[]
  platformStaffIds?: string[]
}) {
  const [members, setMembers] = useState(initialMembers)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const canChangeRoles = ['owner', 'organizer'].includes(callerRole)
  const staffSet = new Set(platformStaffIds)

  async function act(key: string, fn: () => Promise<{ error?: string; success?: boolean }>) {
    setBusy(key)
    setError('')
    const result = await fn()
    if (result.error) setError(result.error)
    setBusy(null)
  }

  const active = members.filter(m => m.status === 'active')
  const pending = members.filter(m => m.status === 'pending')
  const banned = members.filter(m => m.status === 'banned')

  function removeLocal(userId: string) {
    setMembers(ms => ms.filter(m => m.user_id !== userId))
  }

  function updateLocal(userId: string, patch: Partial<Member>) {
    setMembers(ms => ms.map(m => m.user_id === userId ? { ...m, ...patch } : m))
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Pending requests ({pending.length})
          </h3>
          <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
            {pending.map(m => {
              const profile = m.profiles
              if (!profile) return null
              return (
                <div key={m.user_id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <Link href={`/profile/${profile.username}`} className="text-sm font-medium text-stone-800 hover:text-orange-600">
                    {profile.display_name ?? profile.username}
                  </Link>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={busy === `approve-${m.user_id}`}
                      onClick={() => act(`approve-${m.user_id}`, async () => {
                        const r = await approveRequest(communityId, slug, m.user_id)
                        if (r.success) updateLocal(m.user_id, { status: 'active', role: 'member' })
                        return r
                      })}
                      className="px-3 py-1 text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy === `reject-${m.user_id}`}
                      onClick={() => act(`reject-${m.user_id}`, async () => {
                        const r = await rejectRequest(communityId, slug, m.user_id)
                        if (r.success) removeLocal(m.user_id)
                        return r
                      })}
                      className="px-3 py-1 text-xs border border-stone-300 hover:bg-stone-50 disabled:opacity-50 text-stone-600 rounded-lg"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Active members */}
      <section>
        <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
          Members ({active.length})
        </h3>
        <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
          {active.map(m => {
            const profile = m.profiles
            if (!profile) return null
            const isSelf = m.user_id === callerId
            const isProtected = staffSet.has(m.user_id)
            return (
              <div key={m.user_id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <Link href={`/profile/${profile.username}`} className="text-sm font-medium text-stone-800 hover:text-orange-600 truncate">
                    {profile.display_name ?? profile.username}
                  </Link>
                  {isProtected && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded shrink-0">admin</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canChangeRoles && !isSelf && !isProtected ? (
                    <select
                      value={m.role}
                      disabled={!!busy}
                      onChange={async e => {
                        const newRole = e.target.value
                        await act(`role-${m.user_id}`, async () => {
                          const r = await updateMemberRole(communityId, slug, m.user_id, newRole)
                          if (r.success) updateLocal(m.user_id, { role: newRole })
                          return r
                        })
                      }}
                      className="text-xs border border-stone-300 rounded-lg px-2 py-1 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="organizer">Organizer</option>
                    </select>
                  ) : (
                    <span className="text-xs text-stone-400 capitalize">{isProtected && m.role === 'member' ? 'Platform Staff' : m.role}</span>
                  )}

                  {!isSelf && !isProtected && (
                    <>
                      <button
                        disabled={!!busy}
                        onClick={() => act(`ban-${m.user_id}`, async () => {
                          const r = await banMember(communityId, slug, m.user_id)
                          if (r.success) updateLocal(m.user_id, { status: 'banned' })
                          return r
                        })}
                        className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
                        title="Ban"
                      >
                        Ban
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => act(`remove-${m.user_id}`, async () => {
                          const r = await removeMember(communityId, slug, m.user_id)
                          if (r.success) removeLocal(m.user_id)
                          return r
                        })}
                        className="text-xs text-stone-400 hover:text-red-600 disabled:opacity-50"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Banned members */}
      {banned.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Banned ({banned.length})
          </h3>
          <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
            {banned.map(m => {
              const profile = m.profiles
              if (!profile) return null
              return (
                <div key={m.user_id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <Link href={`/profile/${profile.username}`} className="text-sm font-medium text-stone-500 hover:text-orange-600">
                    {profile.display_name ?? profile.username}
                  </Link>
                  <button
                    disabled={busy === `unban-${m.user_id}`}
                    onClick={() => act(`unban-${m.user_id}`, async () => {
                      const r = await unbanMember(communityId, slug, m.user_id)
                      if (r.success) updateLocal(m.user_id, { status: 'active', role: 'member' })
                      return r
                    })}
                    className="px-3 py-1 text-xs border border-stone-300 hover:bg-stone-50 disabled:opacity-50 text-stone-600 rounded-lg"
                  >
                    Unban
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
