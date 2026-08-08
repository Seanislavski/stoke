'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ACTION_LABELS, PHOTO_SOURCE_LABELS } from '@/lib/audit'
import LocalDate from '@/components/LocalDate'

type Profile = { username: string; display_name: string | null } | null
type Community = { name: string; slug: string } | null
type Entry = {
  id: string
  created_at: string
  action: string
  community_id: string | null
  target_user_id: string | null
  target_id: string | null
  target_type: string | null
  metadata: Record<string, unknown> | null
  actor: Profile
  target_user: Profile
  community: Community
}

function truncEdit(s: string) {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > 140 ? `${t.slice(0, 140)}…` : t
}

export default function AuditLogClient({ entries }: { entries: Entry[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return entries
    return entries.filter(entry => {
      const actor = Array.isArray(entry.actor) ? entry.actor[0] : entry.actor
      const targetUser = Array.isArray(entry.target_user) ? entry.target_user[0] : entry.target_user
      const community = Array.isArray(entry.community) ? entry.community[0] : entry.community
      const label = ACTION_LABELS[entry.action] ?? entry.action
      return (
        actor?.username?.toLowerCase().includes(q) ||
        actor?.display_name?.toLowerCase().includes(q) ||
        label.toLowerCase().includes(q) ||
        community?.name?.toLowerCase().includes(q) ||
        targetUser?.username?.toLowerCase().includes(q) ||
        targetUser?.display_name?.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q)
      )
    })
  }, [entries, query])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by user, action, or community…"
          className="flex-1 px-3 py-2 text-sm text-stone-900 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 placeholder-stone-400"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-stone-400 shrink-0">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400">No entries match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-stone-100">
            {filtered.map(entry => {
              const actor = Array.isArray(entry.actor) ? entry.actor[0] : entry.actor
              const targetUser = Array.isArray(entry.target_user) ? entry.target_user[0] : entry.target_user
              const community = Array.isArray(entry.community) ? entry.community[0] : entry.community
              const label = ACTION_LABELS[entry.action] ?? entry.action
              const meta = entry.metadata
              const isPlatform = !entry.community_id
              const communitySlug = community?.slug

              const targetLink = (() => {
                const type = entry.target_type
                if (type === 'post' && communitySlug) return `/communities/${communitySlug}?tab=bulletin`
                if (type === 'resource' && communitySlug) return `/communities/${communitySlug}?tab=resources`
                if (type === 'event' && communitySlug) return `/communities/${communitySlug}?tab=events`
                if (type === 'message' && communitySlug && typeof meta?.channel_id === 'string') return `/communities/${communitySlug}/channels/${meta.channel_id}?message=${entry.target_id}`
                // Q&A: link straight to the question (and to the exact answer via anchor).
                // Skip deleted/rejected items — their pages no longer resolve.
                const gone = entry.action.endsWith('.deleted') || entry.action.endsWith('.rejected')
                if (type === 'question' && communitySlug && entry.target_id && !gone) return `/communities/${communitySlug}/questions/${entry.target_id}`
                if (type === 'answer' && communitySlug && typeof meta?.question_id === 'string' && !gone) return `/communities/${communitySlug}/questions/${meta.question_id}#answer-${entry.target_id}`
                // Reviews/testimonials: the community's testimonials page, or the
                // platform queue for a review of Stoke itself (community_id null).
                if (type === 'review' && !gone) {
                  if (isPlatform || meta?.scope === 'platform') return '/admin/reviews'
                  if (communitySlug) return `/communities/${communitySlug}/testimonials`
                }
                // Photos: link back to where the photo lives (source in metadata).
                if (type === 'photo' && communitySlug) {
                  const src = typeof meta?.source === 'string' ? meta.source : ''
                  const pid = typeof meta?.parent_id === 'string' ? meta.parent_id : null
                  if (src === 'gallery') return `/communities/${communitySlug}?tab=photos`
                  if (src === 'bulletin') return `/communities/${communitySlug}?tab=bulletin`
                  if (src === 'event') return `/communities/${communitySlug}?tab=events`
                  if (src === 'chat' && typeof meta?.channel_id === 'string' && pid) return `/communities/${communitySlug}/channels/${meta.channel_id}?message=${pid}`
                  // qa_question removed → the question is gone; skip. Otherwise link to it.
                  if ((src === 'qa_question' || src === 'qa_answer') && pid && !(src === 'qa_question' && entry.action === 'photo.removed'))
                    return `/communities/${communitySlug}/questions/${pid}`
                }
                if (targetUser?.username) return `/profile/${targetUser.username}`
                return null
              })()

              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <span className="text-stone-400 text-xs shrink-0 mt-0.5 w-36">
                    <LocalDate ts={entry.created_at} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-stone-800">
                      {actor?.display_name ?? actor?.username ?? 'Unknown'}
                    </span>
                    <span className="text-stone-500"> — {label}</span>
                    {targetUser && (
                      <span className="text-stone-400"> · {targetUser.display_name ?? targetUser.username}</span>
                    )}
                    {entry.action === 'member.role_changed' && meta && (
                      <span className="text-stone-400"> · {String(meta.from_role)} → {String(meta.to_role)}</span>
                    )}
                    {(entry.action === 'message.edited' || entry.action === 'message.reverted') && meta && (typeof meta.before === 'string' || typeof meta.after === 'string') && (
                      <span className="block text-xs mt-0.5">
                        <span className="text-stone-400 line-through">{truncEdit(String(meta.before ?? ''))}</span>
                        <span className="text-stone-400"> → </span>
                        <span className="text-stone-600">{truncEdit(String(meta.after ?? ''))}</span>
                      </span>
                    )}
                    {entry.action === 'community.ownership_transferred' && typeof meta?.from_owner_name === 'string' && (
                      <span className="text-stone-400"> · from {meta.from_owner_name}</span>
                    )}
                    {(entry.action === 'platform.role.assigned' || entry.action === 'platform.role.removed') && typeof meta?.role === 'string' && (
                      <span className="text-stone-400"> · {meta.role}</span>
                    )}
                    {entry.action.startsWith('ticket_category.') && typeof meta?.label === 'string' && (
                      <span className="text-stone-400"> · {meta.label}</span>
                    )}
                    {entry.action === 'ticket.status_changed' && meta && (
                      <span className="text-stone-400"> · {String(meta.from_status)} → {String(meta.to_status)}</span>
                    )}
                    {entry.action === 'community.created' && typeof meta?.name === 'string' && (
                      <span className="text-stone-400"> · {meta.name}</span>
                    )}
                    {entry.action === 'community.settings_updated' && meta && (
                      <span className="text-stone-400"> · {typeof meta.name === 'string' ? meta.name : ''}{typeof meta.join_mode === 'string' ? ` · ${meta.join_mode}` : ''}{typeof meta.is_listed === 'boolean' ? ` · ${meta.is_listed ? 'listed' : 'unlisted'}` : ''}</span>
                    )}
                    {entry.action === 'community.listing_changed' && typeof meta?.is_listed === 'boolean' && (
                      <span className="text-stone-400"> · {meta.is_listed ? 'listed' : 'unlisted'}</span>
                    )}
                    {(entry.action === 'channel.created' || entry.action === 'channel.deleted') && typeof meta?.name === 'string' && (
                      <span className="text-stone-400"> · #{meta.name}</span>
                    )}
                    {entry.action === 'email.blast' && typeof meta?.subject === 'string' && (
                      <span className="text-stone-400"> · &ldquo;{meta.subject}&rdquo;{typeof meta.recipient_count === 'number' ? ` · ${meta.recipient_count} recipients` : ''}</span>
                    )}
                    {entry.action.startsWith('photo.') && typeof meta?.source === 'string' && (
                      <span className="text-stone-400"> · {PHOTO_SOURCE_LABELS[meta.source] ?? meta.source}</span>
                    )}
                    {entry.action.startsWith('photo.') && typeof meta?.url === 'string' && (
                      <a href={meta.url} target="_blank" rel="noopener noreferrer" className="block mt-1 w-fit">
                        <img src={meta.url} alt="" className="h-12 w-12 object-cover rounded border border-stone-200 photo-pop" />
                      </a>
                    )}
                    {community && (
                      <span className="ml-2 text-xs text-stone-300">in {community.name}</span>
                    )}
                    {targetLink && (
                      <Link href={targetLink} className="ml-2 text-xs text-orange-500 hover:text-orange-700 hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                  {isPlatform && (
                    <span className="text-xs text-orange-500 font-medium shrink-0">platform</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
