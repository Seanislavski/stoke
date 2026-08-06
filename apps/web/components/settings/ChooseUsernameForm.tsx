'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { chooseUsername } from '@/app/actions/profile'

type Props = {
  /** The username derived for them, pre-filled so keeping it is one click. */
  suggested: string
  next: string
}

export default function ChooseUsernameForm({ suggested, next }: Props) {
  const [username, setUsername] = useState(suggested)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const result = await chooseUsername(username)
    if (result.error) {
      setError(result.error)
      setSaving(false)
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-stone-700 mb-1">
          Username
        </label>
        <div className="flex items-center gap-2">
          <span className="text-stone-400">@</span>
          <input
            id="username"
            type="text"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            title="Letters, numbers, and underscores only"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>
        <p className="mt-1 text-xs text-stone-400">
          Letters, numbers and underscores. This one sticks — you can change your display name
          later, but not your username.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </form>
  )
}
