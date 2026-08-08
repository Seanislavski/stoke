'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// Community-level mod menu. The gear now opens a dropdown surfacing every mod destination
// (review queue, QotW, settings, audit) instead of dumping the mod into the long settings
// scroll. The pending badge lives here alone (the old standalone "N to review" pill was
// removed to avoid a duplicate count next to this one).
export default function CommunityGear({
  slug,
  pendingCount,
}: {
  slug: string
  pendingCount: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const items: { href: string; label: string; badge?: number }[] = [
    { href: `/communities/${slug}/moderation`, label: 'Review queue', badge: pendingCount },
    { href: `/communities/${slug}/qotw`, label: 'Question of the Week' },
    { href: `/communities/${slug}/testimonials`, label: 'Testimonials' },
    { href: `/communities/${slug}/settings`, label: 'Settings' },
    { href: `/communities/${slug}/settings#audit-log`, label: 'Audit log' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
        title="Community menu"
        aria-label="Community menu"
      >
        <GearIcon />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-medium min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center leading-none">
            {pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-stone-200 shadow-lg py-1 z-20">
          {items.map(it => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
            >
              <span>{it.label}</span>
              {it.badge != null && it.badge > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs font-medium min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                  {it.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
