'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export default function AppNav({ profile }: { profile: Profile | null }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/home" className="font-semibold text-orange-500 text-lg tracking-tight">
          Stoke
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/communities" className="text-sm text-stone-600 hover:text-stone-900">
            Discover
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-600">
              {profile?.display_name ?? profile?.username ?? ''}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-stone-400 hover:text-stone-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
