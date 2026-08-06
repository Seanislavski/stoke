'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setDiscordHandlesEnabled } from '@/app/actions/community'

type Props = {
  communityId: string
  slug: string
  enabled: boolean
}

export default function DiscordHandlesToggle({ communityId, slug, enabled }: Props) {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [error, setError] = useState('')
  const router = useRouter()

  async function toggle() {
    const next = !isEnabled
    setIsEnabled(next)
    setError('')
    const result = await setDiscordHandlesEnabled(communityId, slug, next)
    if (result.error) {
      setIsEnabled(!next)
      setError(result.error)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={toggle}
          className="mt-0.5 h-4 w-4 accent-orange-500"
        />
        <span className="text-sm text-stone-700">
          Show member Discord usernames in the member list
          <span className="block text-xs text-stone-400">
            Only members who have added a Discord username and chosen to show it will appear.
            Everyone else is unaffected.
          </span>
        </span>
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
