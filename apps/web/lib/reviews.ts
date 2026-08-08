import type { ReviewItem } from '@/components/reviews/ReviewList'

// Shared select + mapper so every surface shapes review rows identically.
export const REVIEW_COLS =
  'id, body, rating, status, is_featured, featured_position, created_at, attribution, reply_body, reply_is_public, reply_at, profiles!author_id(username, display_name, avatar_url)'

export type RawReview = {
  id: string
  body: string
  rating: number | null
  status: 'pending' | 'published' | 'rejected'
  is_featured: boolean
  featured_position: number | null
  created_at: string
  attribution: string | null
  reply_body: string | null
  reply_is_public: boolean
  reply_at: string | null
  profiles:
    | { username: string; display_name: string | null; avatar_url: string | null }
    | { username: string; display_name: string | null; avatar_url: string | null }[]
    | null
}

export function mapReview(r: RawReview): ReviewItem {
  const a = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
  // A captured testimonial is authored by the Silas system user, so its joined
  // profile must never surface — the attribution line stands in for the author
  // entirely (no profile link, no bot avatar). Claiming clears attribution and
  // the real profile takes over from the same fields.
  const captured = !!r.attribution
  return {
    id: r.id,
    body: r.body,
    rating: r.rating,
    status: r.status,
    is_featured: r.is_featured,
    featured_position: r.featured_position ?? 0,
    created_at: r.created_at,
    attribution: r.attribution,
    author_username: captured ? null : a?.username ?? null,
    author_name: captured ? null : a?.display_name ?? null,
    author_avatar: captured ? null : a?.avatar_url ?? null,
    reply_body: r.reply_body,
    reply_is_public: r.reply_is_public,
    reply_at: r.reply_at,
  }
}
