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
  answerCount: number
}

/**
 * Shown to a signed-in visitor who isn't a member yet, in place of the answers.
 *
 * They used to get a bare 404 here — the least informative screen on the platform handed
 * to the person furthest along. Answers stay members-only; this just gives them the way in.
 * joinCommunity only revalidates /communities/{slug}, so an open join needs an explicit
 * refresh to re-render this page with the answers visible.
 */
export default function QuestionJoinGate({ communityId, communityName, slug, joinMode, answerCount }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [requested, setRequested] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const count = answerCount === 1 ? '1 answer has' : `${answerCount} answers have`

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
      {answerCount === 0 ? (
        <p className="text-sm text-stone-600">No answers yet — join to be the first to help.</p>
      ) : (
        <>
          <p className="text-sm text-stone-600">🔒 {count} been shared.</p>
          <p className="mt-1 text-sm text-stone-500">
            Answers are for members of {communityName}. Join to read {answerCount === 1 ? 'it' : 'them'} and add your own.
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
