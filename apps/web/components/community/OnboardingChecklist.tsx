'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { dismissOnboarding } from '@/app/actions/community'

type Props = {
  communityId: string
  slug: string
  hasPost: boolean
  hasChannel: boolean
  hasMember: boolean
  hasEvent: boolean
}

function Step({ done, label, href, description }: { done: boolean; label: string; href: string; description: string }) {
  return (
    <Link
      href={done ? '#' : href}
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${done ? 'opacity-50 cursor-default' : 'hover:bg-orange-50'}`}
    >
      <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border-2 ${
        done
          ? 'bg-green-500 border-green-500 text-white'
          : 'border-stone-300 text-stone-300'
      }`}>
        {done ? '✓' : ''}
      </span>
      <div>
        <p className={`text-sm font-medium ${done ? 'line-through text-stone-400' : 'text-stone-800'}`}>{label}</p>
        {!done && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
      </div>
    </Link>
  )
}

export default function OnboardingChecklist({ communityId, slug, hasPost, hasChannel, hasMember, hasEvent }: Props) {
  // The server already hides this once onboarding_dismissed_at is set; this is only
  // so the box disappears immediately on click rather than after the revalidate.
  const [dismissed, setDismissed] = useState(false)
  const [pending, startTransition] = useTransition()

  const allDone = hasPost && hasChannel && hasMember && hasEvent
  if (allDone || dismissed) return null

  const doneCount = [hasPost, hasChannel, hasMember, hasEvent].filter(Boolean).length

  const dismiss = () => {
    setDismissed(true)
    startTransition(() => void dismissOnboarding(communityId, slug))
  }

  return (
    <div className="bg-white rounded-xl border border-orange-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">Get your community started</h2>
          <p className="text-xs text-stone-400 mt-0.5">{doneCount} of 4 steps complete</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[hasPost, hasChannel, hasMember, hasEvent].map((done, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${done ? 'bg-green-500' : 'bg-stone-200'}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            aria-label="Dismiss checklist"
            title="Dismiss for good"
            className="flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-stone-600 disabled:opacity-50 transition-colors -mr-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
            Hide
          </button>
        </div>
      </div>
      <div className="space-y-1">
        <Step
          done={hasPost}
          label="Write a welcome post"
          href={`/communities/${slug}?tab=bulletin`}
          description="Introduce your community and let members know what to expect."
        />
        <Step
          done={hasChannel}
          label="Create a channel"
          href={`/communities/${slug}/settings`}
          description="Add a space for ongoing conversation — a general or introductions channel is a great start."
        />
        <Step
          done={hasMember}
          label="Invite your first member"
          href={`/communities/${slug}/settings`}
          description="Share an invite link to bring in your first members."
        />
        <Step
          done={hasEvent}
          label="Schedule an event"
          href={`/communities/${slug}?tab=events`}
          description="Give members something to look forward to and show up for."
        />
      </div>
      <div className="mt-3 pt-3 border-t border-stone-100">
        <Link href="/guide" className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline">
          New to running a community? Read the organizer guide →
        </Link>
      </div>
    </div>
  )
}
