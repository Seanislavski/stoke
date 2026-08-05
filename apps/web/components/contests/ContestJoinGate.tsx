'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { joinCommunity } from '@/app/actions/membership'

type Props = {
  communityId: string
  communityName: string
  slug: string
  joinMode: string
  entryCount: number
  /** False once entries have closed — "join to enter" would be a lie then. */
  acceptingEntries: boolean
}

/**
 * Shown to a signed-in visitor who isn't a member yet, in place of the entries.
 *
 * Same shape and same reasoning as QuestionJoinGate: without it they'd get a bare
 * 404, which is the least informative screen on the platform handed to the person
 * furthest along. Entries stay members-only; this gives them the way in.
 *
 * ⚠️ joinCommunity only revalidates /communities/{slug}, so an open join needs an
 * explicit router.refresh() or they join and keep staring at the locked panel.
 */
export default function ContestJoinGate({
  communityId, communityName, slug, joinMode, entryCount, acceptingEntries,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [requested, setRequested] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin() {
    setError(null)
    const result = await joinCommunity(communityId, joinMode, slug)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.status === 'active') startTransition(() => router.refresh())
    else setRequested(true)
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
      {acceptingEntries ? (
        <>
          <p className="text-sm text-stone-600">
            🔒 This contest is open to members of {communityName}.
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Join to enter your own design{entryCount > 0 ? ' and see the entries once voting opens' : ''}.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-600">🔒 Entries are closed for this contest.</p>
          <p className="mt-1 text-sm text-stone-500">
            Join {communityName} to see the entries and vote.
          </p>
        </>
      )}

      {requested ? (
        <p className="mt-4 text-sm font-medium text-stone-700">
          Request sent — an organizer will review it.
        </p>
      ) : joinMode === 'invite_only' ? (
        <p className="mt-4 text-sm text-stone-500">
          {communityName} is invite-only. You&apos;ll need an invite link from an organizer.
        </p>
      ) : (
        <button
          onClick={handleJoin}
          disabled={pending}
          className="mt-4 inline-block bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
        >
          {pending ? 'Joining…' : joinMode === 'open' ? `Join ${communityName}` : 'Request to join'}
        </button>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-4 text-xs text-stone-400">
        <Link href={`/communities/${slug}`} className="hover:text-stone-600 underline">
          Visit {communityName} first
        </Link>
      </p>
    </div>
  )
}
