'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearDiscordLink } from '@/app/actions/profile'

type Props = {
  linked: boolean
  handle: string | null
}

export default function LinkDiscord({ linked, handle }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function link() {
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        // Back through our own callback, which reads the new identity, stores
        // the Discord id and claims anything they wrote that was captured.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings/profile')}`,
      },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
    // On success the browser leaves for Discord.
  }

  async function unlink() {
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data, error: listError } = await supabase.auth.getUserIdentities()
    if (listError || !data) {
      setError('Could not read your sign-in methods.')
      setBusy(false)
      return
    }

    const discord = data.identities.find(i => i.provider === 'discord')
    if (!discord) {
      setError('No Discord account is connected.')
      setBusy(false)
      return
    }
    // Supabase refuses to remove the only identity, which would lock the
    // account out. Say so plainly instead of surfacing that as a raw error.
    if (data.identities.length < 2) {
      setError(
        'Discord is your only way to sign in. Add a password first, then you can disconnect it.',
      )
      setBusy(false)
      return
    }

    const { error } = await supabase.auth.unlinkIdentity(discord)
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }

    // Credit for anything already claimed stays put — disconnecting is about
    // the sign-in method, not about disowning what you wrote.
    await clearDiscordLink()
    setBusy(false)
    router.refresh()
  }

  if (linked) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
          <span className="text-sm text-stone-700">
            <span className="text-green-600">✓</span> Discord connected
            {handle && <span className="ml-1 font-mono text-xs text-stone-500">{handle}</span>}
          </span>
          <button
            type="button"
            onClick={unlink}
            disabled={busy}
            className="text-xs text-stone-500 hover:text-red-600 disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? 'Working…' : 'Disconnect'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={link}
        disabled={busy}
        className="flex items-center justify-center gap-2.5 px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor" aria-hidden="true">
          <path d="M60.1 4.9A58.6 58.6 0 0 0 45.5.4a.2.2 0 0 0-.2.1c-.6 1.1-1.3 2.6-1.8 3.7a54.1 54.1 0 0 0-16.2 0c-.5-1.2-1.2-2.6-1.9-3.7a.2.2 0 0 0-.2-.1c-5.1.9-10 2.4-14.6 4.5a.2.2 0 0 0-.1.1C1.6 18.7-.9 32.1.3 45.4a.2.2 0 0 0 .1.2 58.9 58.9 0 0 0 17.8 9 .2.2 0 0 0 .2-.1c1.4-1.9 2.6-3.9 3.6-6a.2.2 0 0 0-.1-.3c-1.9-.7-3.8-1.6-5.6-2.6a.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.6 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .4c-1.8 1-3.6 1.9-5.6 2.6a.2.2 0 0 0-.1.3c1 2.1 2.3 4.1 3.6 6a.2.2 0 0 0 .2.1 58.6 58.6 0 0 0 17.9-9 .2.2 0 0 0 .1-.2c1.5-15.3-2.5-28.6-10.4-40.4a.2.2 0 0 0-.1-.1ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2Z" />
        </svg>
        Connect Discord
      </button>
      <p className="text-xs text-stone-400">
        Fills in your username automatically, and credits you for anything you wrote on Discord
        that a community has archived.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
