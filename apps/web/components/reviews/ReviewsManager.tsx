'use client'

import { useState } from 'react'
import Link from 'next/link'
import { type ReviewItem, Stars } from './ReviewList'
import {
  approveReview, rejectReview, toggleFeatureReview,
  deleteReview, setReviewReply, reorderFeatured,
} from '@/app/actions/reviews'

const MAX_FEATURED = 6

type Filter = 'all' | 'pending' | 'published' | 'featured' | 'rejected'

type Props = {
  communityId: string | null
  slug: string | null
  initialReviews: ReviewItem[]
}

export default function ReviewsManager({ communityId, slug, initialReviews }: Props) {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews)
  const [filter, setFilter] = useState<Filter>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [replyOpen, setReplyOpen] = useState<string | null>(null)

  const patch = (id: string, fields: Partial<ReviewItem>) =>
    setReviews(prev => prev.map(r => (r.id === id ? { ...r, ...fields } : r)))

  async function run(key: string, fn: () => Promise<{ error?: string }>, onOk?: () => void) {
    setBusy(key)
    setError('')
    const result = await fn()
    setBusy(null)
    if (result?.error) setError(result.error)
    else onOk?.()
  }

  const featuredCount = reviews.filter(r => r.is_featured).length
  const published = reviews.filter(r => r.status === 'published')
  const rated = published.filter(r => r.rating)
  const avg = rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : 0
  const dist = [5, 4, 3, 2, 1].map(star => ({ star, n: rated.filter(r => r.rating === star).length }))

  const counts: Record<Filter, number> = {
    all: reviews.length,
    pending: reviews.filter(r => r.status === 'pending').length,
    published: published.length,
    featured: featuredCount,
    rejected: reviews.filter(r => r.status === 'rejected').length,
  }

  const featuredOrdered = reviews
    .filter(r => r.is_featured)
    .sort((a, b) => (a.featured_position ?? 0) - (b.featured_position ?? 0))

  const visible = (() => {
    if (filter === 'featured') return featuredOrdered
    if (filter === 'all') return [...reviews].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    return reviews
      .filter(r => (filter === 'published' ? r.status === 'published' : r.status === filter))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  })()

  async function moveFeatured(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= featuredOrdered.length) return
    const ids = featuredOrdered.map(r => r.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    // Optimistically renumber.
    setReviews(prev => prev.map(r => {
      const i = ids.indexOf(r.id)
      return i >= 0 ? { ...r, featured_position: i + 1 } : r
    }))
    await run(`reorder-${index}`, () => reorderFeatured(communityId, slug, ids))
  }

  const TABS: { key: Filter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'published', label: 'Published' },
    { key: 'featured', label: 'Featured' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div className="space-y-4">
      {/* Sentiment snapshot */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-center gap-6">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900">{rated.length ? avg.toFixed(1) : '—'}</span>
            <Stars rating={rated.length ? Math.round(avg) : null} />
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {published.length} published · {rated.length} rated
          </p>
        </div>
        <div className="flex-1 min-w-[180px] space-y-1">
          {dist.map(({ star, n }) => {
            const pct = rated.length ? (n / rated.length) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-2 text-xs text-stone-400">
                <span className="w-3 text-right">{star}</span>
                <span className="text-orange-400">★</span>
                <span className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <span className="block h-full bg-orange-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-5 text-right">{n}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              filter === t.key ? 'bg-white text-stone-900 font-medium shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label} <span className="text-stone-400">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {filter === 'featured' && (
        <p className="text-xs text-stone-400">
          The top {MAX_FEATURED} featured reviews show publicly, in this order. Use the arrows to reorder.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {visible.length === 0 ? (
        <p className="text-sm text-stone-400 py-4">No reviews here.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((r, index) => {
            const name = r.attribution ?? r.author_name ?? r.author_username ?? 'Member'
            const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            const atFeatureCap = featuredCount >= MAX_FEATURED && !r.is_featured
            return (
              <div key={r.id} className="bg-white border border-stone-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-semibold text-stone-500 shrink-0 overflow-hidden">
                      {r.author_avatar ? <img src={r.author_avatar} alt="" className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.author_username ? (
                          <Link href={`/profile/${r.author_username}`} className="text-sm font-medium text-stone-900 hover:text-orange-600">{name}</Link>
                        ) : <span className="text-sm font-medium text-stone-900">{name}</span>}
                        {r.attribution && <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">via Discord</span>}
                        {r.is_featured && <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">Featured</span>}
                        {r.status === 'pending' && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Pending</span>}
                        {r.status === 'rejected' && <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">Rejected</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-stone-400">
                        <Stars rating={r.rating} />
                        <span>{date}</span>
                      </div>
                    </div>
                  </div>

                  {filter === 'featured' && (
                    <div className="flex flex-col shrink-0">
                      <button onClick={() => moveFeatured(index, -1)} disabled={index === 0 || !!busy} className="text-stone-400 hover:text-stone-700 disabled:opacity-30 leading-none">▲</button>
                      <button onClick={() => moveFeatured(index, 1)} disabled={index === featuredOrdered.length - 1 || !!busy} className="text-stone-400 hover:text-stone-700 disabled:opacity-30 leading-none">▼</button>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{r.body}</p>

                {r.reply_body && (
                  <div className="mt-3 ml-4 border-l-2 border-orange-200 pl-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-orange-600">Your response</span>
                      <span className="text-[10px] uppercase tracking-wide text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{r.reply_is_public ? 'Public' : 'Private'}</span>
                    </div>
                    <p className="mt-1 text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">{r.reply_body}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {r.status === 'pending' && (
                    <>
                      <button onClick={() => run(`approve-${r.id}`, () => approveReview(r.id, communityId, slug), () => patch(r.id, { status: 'published' }))} disabled={!!busy}
                        className="text-xs px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full font-medium disabled:opacity-50">
                        {busy === `approve-${r.id}` ? '…' : 'Approve'}
                      </button>
                      <button onClick={() => run(`reject-${r.id}`, () => rejectReview(r.id, communityId, slug), () => patch(r.id, { status: 'rejected', is_featured: false }))} disabled={!!busy}
                        className="text-xs px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full font-medium disabled:opacity-50">
                        {busy === `reject-${r.id}` ? '…' : 'Reject'}
                      </button>
                    </>
                  )}

                  {r.status === 'rejected' && (
                    <button onClick={() => run(`approve-${r.id}`, () => approveReview(r.id, communityId, slug), () => patch(r.id, { status: 'published' }))} disabled={!!busy}
                      className="text-xs px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full font-medium disabled:opacity-50">
                      {busy === `approve-${r.id}` ? '…' : 'Approve'}
                    </button>
                  )}

                  {r.status === 'published' && (
                    <button
                      onClick={() => run(`feature-${r.id}`, () => toggleFeatureReview(r.id, communityId, slug), () => patch(r.id, { is_featured: !r.is_featured, featured_position: !r.is_featured ? featuredCount + 1 : 0 }))}
                      disabled={!!busy || atFeatureCap}
                      title={atFeatureCap ? `You can feature up to ${MAX_FEATURED} reviews` : undefined}
                      className={`text-xs px-3 py-1 rounded-full font-medium disabled:opacity-50 ${r.is_featured ? 'bg-orange-100 hover:bg-orange-200 text-orange-700' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'}`}>
                      {busy === `feature-${r.id}` ? '…' : r.is_featured ? '★ Unfeature' : '☆ Feature'}
                    </button>
                  )}

                  {(r.status === 'published') && (
                    <button onClick={() => setReplyOpen(replyOpen === r.id ? null : r.id)} disabled={!!busy}
                      className="text-xs px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-full font-medium disabled:opacity-50">
                      {r.reply_body ? 'Edit reply' : 'Reply'}
                    </button>
                  )}

                  <button onClick={() => { if (confirm('Delete this review permanently?')) run(`delete-${r.id}`, () => deleteReview(r.id, communityId, slug), () => setReviews(prev => prev.filter(x => x.id !== r.id))) }} disabled={!!busy}
                    className="text-xs px-3 py-1 text-stone-400 hover:text-red-600 rounded-full font-medium disabled:opacity-50">
                    {busy === `delete-${r.id}` ? '…' : 'Delete'}
                  </button>
                </div>

                {/* Reply editor */}
                {replyOpen === r.id && (
                  <ReplyEditor
                    review={r}
                    busy={busy === `reply-${r.id}`}
                    onSave={async (formData) => {
                      await run(`reply-${r.id}`, () => setReviewReply(r.id, communityId, slug, formData), () => {
                        const body = (formData.get('reply_body') as string)?.trim()
                        patch(r.id, body
                          ? { reply_body: body, reply_is_public: formData.get('reply_visibility') === 'public', reply_at: new Date().toISOString() }
                          : { reply_body: null, reply_is_public: false, reply_at: null })
                        setReplyOpen(null)
                      })
                    }}
                    onCancel={() => setReplyOpen(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReplyEditor({ review, busy, onSave, onCancel }: {
  review: ReviewItem
  busy: boolean
  onSave: (formData: FormData) => void
  onCancel: () => void
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)) }}
      className="mt-3 bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2"
    >
      <textarea
        name="reply_body"
        rows={3}
        maxLength={1000}
        defaultValue={review.reply_body ?? ''}
        placeholder="Write a response to this review…"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
      />
      <div className="flex items-center gap-4 text-sm text-stone-600">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="reply_visibility" value="public" defaultChecked={review.reply_is_public} /> Public
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="reply_visibility" value="private" defaultChecked={!review.reply_is_public} /> Private
        </label>
        <span className="text-xs text-stone-400">Public shows under the review everywhere; private is seen only by the reviewer and your staff.</span>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
          {busy ? '…' : 'Save reply'}
        </button>
        {review.reply_body && (
          <button type="submit" disabled={busy}
            onClick={(e) => {
              const form = e.currentTarget.form!
              ;(form.elements.namedItem('reply_body') as HTMLTextAreaElement).value = ''
            }}
            className="px-3 py-1.5 text-sm text-stone-500 hover:text-red-600">
            Remove reply
          </button>
        )}
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700">Cancel</button>
      </div>
    </form>
  )
}
