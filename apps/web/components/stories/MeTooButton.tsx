'use client'

import { useState, useTransition } from 'react'
import { toggleMeToo } from '@/app/actions/stories'

type Props = { storyId: string; communityId: string; slug: string; initialOn: boolean }

// One tap: "this is me too". Deliberately shows NO count — only the story's
// author sees how many people said it (no public ranking, no upvotes).
export default function MeTooButton({ storyId, communityId, slug, initialOn }: Props) {
  const [on, setOn] = useState(initialOn)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function handleClick() {
    setError('')
    const next = !on
    setOn(next) // optimistic
    startTransition(async () => {
      const result = await toggleMeToo(storyId, communityId, slug)
      if (result.error) {
        setOn(!next)
        setError(result.error)
      } else if (typeof result.on === 'boolean') {
        setOn(result.on)
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={on}
        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
          on
            ? 'bg-orange-50 border-orange-300 text-orange-700'
            : 'bg-white border-stone-300 text-stone-600 hover:border-orange-300 hover:text-orange-600'
        }`}
      >
        💛 {on ? 'You said me too' : 'Me too'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
