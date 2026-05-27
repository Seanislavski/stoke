'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminNav({ role }: { role: string }) {
  const pathname = usePathname()
  const isOwner = role === 'owner'
  const canModerate = role === 'platform_moderator' || isOwner
  const canManageCommunities = role === 'community_manager' || isOwner
  const canSupport = role === 'support' || role === 'platform_moderator' || isOwner

  const links = [
    ...(isOwner ? [{ href: '/admin', label: 'Overview', exact: true }] : []),
    ...(canModerate ? [{ href: '/admin/users', label: 'Users', exact: false }] : []),
    ...(canManageCommunities ? [{ href: '/admin/communities', label: 'Communities', exact: false }] : []),
    ...(canModerate ? [{ href: '/admin/moderation', label: 'Moderation', exact: false }] : []),
    ...(canSupport ? [{ href: '/admin/support', label: 'Support', exact: false }] : []),
  ]

  return (
    <div className="flex items-center gap-1 mb-6 border-b border-stone-200 pb-4">
      <span className="text-xs font-medium text-stone-400 uppercase tracking-wide mr-3">Admin</span>
      {links.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              active
                ? 'bg-orange-100 text-orange-700 font-medium'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
