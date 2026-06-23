import Link from 'next/link'

export type ReviewItem = {
  id: string
  body: string
  rating: number | null
  status: 'pending' | 'published' | 'rejected'
  is_featured: boolean
  created_at: string
  author_username: string | null
  author_name: string | null
  author_avatar: string | null
  reply_body: string | null
  reply_is_public: boolean
  reply_at: string | null
  featured_position?: number
}

export function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <span className="text-orange-500 text-sm tracking-tight" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}<span className="text-stone-300">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

// Public replies show to everyone; private replies only to staff or the review's author.
export function canSeeReply(r: ReviewItem, viewerIsStaff: boolean, viewerUsername: string | null) {
  if (!r.reply_body) return false
  return r.reply_is_public || viewerIsStaff || (!!viewerUsername && viewerUsername === r.author_username)
}

export function ReplyBlock({ r, showPrivacy }: { r: ReviewItem; showPrivacy?: boolean }) {
  if (!r.reply_body) return null
  return (
    <div className="mt-3 ml-4 border-l-2 border-orange-200 pl-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-orange-600">Response from the organizers</span>
        {showPrivacy && !r.reply_is_public && (
          <span className="text-[10px] uppercase tracking-wide text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">Private</span>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">{r.reply_body}</p>
    </div>
  )
}

type Props = {
  reviews: ReviewItem[]
  viewerIsStaff?: boolean
  viewerUsername?: string | null
}

export default function ReviewList({ reviews, viewerIsStaff = false, viewerUsername = null }: Props) {
  if (reviews.length === 0) return null

  return (
    <div className="space-y-3">
      {reviews.map(r => {
        const name = r.author_name ?? r.author_username ?? 'Member'
        const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return (
          <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-sm font-semibold text-stone-500 shrink-0 overflow-hidden">
                {r.author_avatar
                  ? <img src={r.author_avatar} alt="" className="w-full h-full object-cover" />
                  : name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.author_username ? (
                    <Link href={`/profile/${r.author_username}`} className="text-sm font-medium text-stone-900 hover:text-orange-600">
                      {name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-stone-900">{name}</span>
                  )}
                  {r.is_featured && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                      Featured
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <Stars rating={r.rating} />
                  <span>{date}</span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{r.body}</p>

            {canSeeReply(r, viewerIsStaff, viewerUsername) && <ReplyBlock r={r} showPrivacy={viewerIsStaff} />}
          </div>
        )
      })}
    </div>
  )
}
