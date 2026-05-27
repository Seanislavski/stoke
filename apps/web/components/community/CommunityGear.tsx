'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

type CallerRole = 'owner' | 'organizer' | 'moderator'

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export default function CommunityGear({
  slug,
  callerRole,
  joinMode,
  pendingCount,
  bannedCount,
}: {
  slug: string
  callerRole: CallerRole
  joinMode: string
  pendingCount: number
  bannedCount: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const canChangeRoles = ['owner', 'organizer'].includes(callerRole)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 focus:outline-none"
        title="Community settings"
      >
        <GearIcon />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-stone-200 shadow-lg py-1 z-20">
          <div className="py-1">
            <Link
              href={`/communities/${slug}/settings`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
            >
              Community settings
            </Link>

            {(joinMode !== 'open' || pendingCount > 0) && (
              <Link
                href={`/communities/${slug}/settings`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                <span>Member requests</span>
                {pendingCount > 0 && (
                  <span className="bg-orange-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </Link>
            )}

            {bannedCount > 0 && (
              <Link
                href={`/communities/${slug}/settings`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                <span>Banned members</span>
                <span className="text-xs text-stone-400">{bannedCount}</span>
              </Link>
            )}

            {canChangeRoles && (
              <Link
                href={`/communities/${slug}/settings`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                Manage roles
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
