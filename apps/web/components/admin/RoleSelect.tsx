'use client'

import { useTransition } from 'react'
import { assignPlatformRole } from '@/app/actions/admin'

const ROLES = [
  { value: '', label: 'No platform role' },
  { value: 'platform_moderator', label: 'Platform Moderator' },
  { value: 'community_manager', label: 'Community Manager' },
  { value: 'support', label: 'Support' },
]

export default function RoleSelect({
  userId,
  currentRole,
}: {
  userId: string
  currentRole: string | null
}) {
  const [pending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    startTransition(() => assignPlatformRole(userId, val || null))
  }

  return (
    <select
      value={currentRole ?? ''}
      onChange={handleChange}
      disabled={pending}
      className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white text-stone-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-300"
    >
      {ROLES.map(r => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  )
}
