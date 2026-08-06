'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// One component for both login and signup — with OAuth they are the same act,
// and keeping them in one place stops the two pages drifting apart.
export default function DiscordSignIn({ redirectTo }: { redirectTo: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        // Our own callback, not Supabase's — it links the Discord identity and
        // claims any captured posts before the member lands anywhere.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success the browser leaves for Discord — deliberately no reset here,
    // so the button stays disabled through the redirect.
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" aria-hidden="true">
          <path d="M60.1 4.9A58.6 58.6 0 0 0 45.5.4a.2.2 0 0 0-.2.1c-.6 1.1-1.3 2.6-1.8 3.7a54.1 54.1 0 0 0-16.2 0c-.5-1.2-1.2-2.6-1.9-3.7a.2.2 0 0 0-.2-.1c-5.1.9-10 2.4-14.6 4.5a.2.2 0 0 0-.1.1C1.6 18.7-.9 32.1.3 45.4a.2.2 0 0 0 .1.2 58.9 58.9 0 0 0 17.8 9 .2.2 0 0 0 .2-.1c1.4-1.9 2.6-3.9 3.6-6a.2.2 0 0 0-.1-.3c-1.9-.7-3.8-1.6-5.6-2.6a.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.6 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .4c-1.8 1-3.6 1.9-5.6 2.6a.2.2 0 0 0-.1.3c1 2.1 2.3 4.1 3.6 6a.2.2 0 0 0 .2.1 58.6 58.6 0 0 0 17.9-9 .2.2 0 0 0 .1-.2c1.5-15.3-2.5-28.6-10.4-40.4a.2.2 0 0 0-.1-.1ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2Z" />
        </svg>
        {loading ? 'Opening Discord…' : 'Continue with Discord'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-stone-200" />
        <span className="text-xs text-stone-400">or</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>
    </div>
  )
}
