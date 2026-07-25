'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StokeWordmark from '@/components/StokeWordmark'
import NotificationsBell from '@/components/NotificationsBell'

type Profile = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type PlatformRole = 'owner' | 'platform_moderator' | 'community_manager' | 'support' | null

// Land each platform role on the first admin page it can actually use (mirrors AdminNav's
// per-role link visibility).
function adminHref(role: NonNullable<PlatformRole>) {
  switch (role) {
    case 'owner': return '/admin'
    case 'platform_moderator': return '/admin/users'
    case 'community_manager': return '/admin/communities'
    case 'support': return '/admin/support'
  }
}

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export default function AppNav({
  profile,
  platformRole = null,
  userId,
  isCommunityStaff = false,
}: {
  profile: Profile | null
  platformRole?: PlatformRole
  userId: string
  isCommunityStaff?: boolean
}) {
  const router = useRouter()
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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = ((profile?.display_name ?? profile?.username) || '?')[0].toUpperCase()

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/home">
            <StokeWordmark iconSize={28} />
          </Link>
          <Link href="/communities" className="text-sm text-stone-600 hover:text-stone-900">
            Discover
          </Link>
        </div>

        <NotificationsBell userId={userId} />
        <div ref={ref} className="relative ml-1">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 focus:outline-none"
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden flex items-center justify-center text-sm font-semibold text-stone-500 flex-shrink-0">
              {profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt="avatar" width={32} height={32} className="w-full h-full object-cover" />
              ) : initials}
            </div>
            <GearIcon />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-stone-200 shadow-lg py-1 z-20">
              {/* Identity */}
              <Link
                href="/settings/profile"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 border-b border-stone-100 hover:bg-stone-50"
              >
                <p className="text-sm font-medium text-stone-900 truncate">
                  {profile?.display_name ?? profile?.username}
                </p>
                {profile?.username && (
                  <p className="text-xs text-stone-400 truncate">@{profile.username}</p>
                )}
              </Link>

              {/* Common */}
              <div className="py-1">
                <Link
                  href="/communities/mine"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  My communities
                </Link>
                {isCommunityStaff && (
                  <>
                    <Link
                      href="/guide"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                    >
                      Organizer guide
                    </Link>
                    <Link
                      href="/guide/capture"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                    >
                      Capturing Discord posts
                    </Link>
                  </>
                )}
                <Link
                  href="/settings/billing"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  Billing
                </Link>
                <Link
                  href="/support"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  Support
                </Link>
                <Link
                  href="/feedback"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  Share your experience
                </Link>
                <Link
                  href="/changelog"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  What&apos;s new
                </Link>
              </div>

              {/* Platform team — single entry into the admin area; AdminNav takes over
                  inside and is the source of truth for the sub-pages/labels. Lands each
                  role on the first page it can actually use. */}
              {platformRole && (
                <div className="py-1 border-t border-stone-100">
                  <Link
                    href={adminHref(platformRole)}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    Admin
                  </Link>
                </div>
              )}

              {/* Sign out */}
              <div className="py-1 border-t border-stone-100">
                <button
                  onClick={() => { setOpen(false); handleSignOut() }}
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
