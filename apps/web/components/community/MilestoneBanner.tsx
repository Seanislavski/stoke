import Link from 'next/link'
import { formatThreshold, milestoneFor } from '@/lib/milestones'

// "We just reached N members" — shown on the community page for
// CELEBRATION_DAYS after a milestone is crossed. Mods also get a one-click way
// to announce it on the bulletin board (a prefilled post they can edit; nothing
// is posted for them).
export default function MilestoneBanner({
  threshold,
  communityName,
  slug,
  isMod,
}: {
  threshold: number
  communityName: string
  slug: string
  isMod: boolean
}) {
  const m = milestoneFor(threshold)
  if (!m) return null
  const n = formatThreshold(threshold)

  return (
    <div className={`relative overflow-hidden rounded-xl border border-stone-200 bg-white p-5 ring-2 ${m.ring}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="text-4xl leading-none milestone-pop" aria-hidden>🎉</div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-stone-900">
            {communityName} just reached {n} members!
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Thank you to everyone who has joined, shown up and helped make this place what it is.
          </p>
        </div>
        {isMod && (
          <Link
            href={`/communities/${slug}?tab=bulletin&celebrate=${threshold}#new-post`}
            className="shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors text-center"
          >
            Announce it
          </Link>
        )}
      </div>
    </div>
  )
}
