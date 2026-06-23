'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'
import { sendEmail, reviewSubmittedHtml, reviewFeaturedHtml } from '@/lib/email'

// ─── helpers ───────────────────────────────────────────────────────────────────
// A review's scope is its community_id: non-null = a community review, null = a
// platform-level review of Stoke. "Mod" authority differs by scope.

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function isPlatformMod(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('platform_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['owner', 'platform_moderator'])
    .maybeSingle()
  return !!data
}

// Eligibility + mod flags for a community review.
async function communityAccess(communityId: string, userId: string) {
  const admin = createAdminClient()
  const [{ data: membership }, { data: community }, platformMod] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', userId).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    isPlatformMod(userId),
  ])
  const isOwner = userId === community?.owner_id
  const isMod = isOwner || platformMod || ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isActiveMember = membership?.status === 'active' || isOwner
  return { isMod, isActiveMember }
}

async function requireMod(communityId: string | null, userId: string) {
  if (!communityId) return await isPlatformMod(userId)
  const { isMod } = await communityAccess(communityId, userId)
  return isMod
}

// Display name + email/revalidate paths for a scope.
async function scopeInfo(communityId: string | null) {
  if (!communityId) {
    return { name: 'Stoke', reviewPath: '/admin/reviews', viewPath: '/' }
  }
  const admin = createAdminClient()
  const { data: c } = await admin.from('communities').select('name, slug').eq('id', communityId).single()
  return {
    name: c?.name ?? 'the community',
    reviewPath: `/communities/${c?.slug}?tab=reviews`,
    viewPath: `/communities/${c?.slug}`,
  }
}

function revalidateFor(communityId: string | null, slug: string | null) {
  const paths = communityId
    ? (slug ? [`/communities/${slug}`, `/preview/${slug}`] : [])
    : ['/', '/admin/reviews']
  for (const p of paths) revalidatePath(p)
}

async function modEmailsFor(communityId: string | null) {
  const admin = createAdminClient()
  let ids: string[] = []
  if (!communityId) {
    const { data: staff } = await admin.from('platform_roles').select('user_id').in('role', ['owner', 'platform_moderator'])
    ids = (staff ?? []).map(s => s.user_id)
  } else {
    const [{ data: community }, { data: mods }] = await Promise.all([
      admin.from('communities').select('owner_id').eq('id', communityId).single(),
      admin.from('community_members').select('user_id').eq('community_id', communityId).eq('status', 'active').in('role', ['organizer', 'moderator']),
    ])
    ids = [...(community ? [community.owner_id] : []), ...(mods ?? []).map(m => m.user_id)]
  }
  const emails: string[] = []
  for (const id of new Set(ids)) {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data.user?.email) emails.push(data.user.email)
  }
  return emails
}

async function emailFor(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

function parseRating(formData: FormData) {
  const raw = formData.get('rating') as string
  if (!raw) return null
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? null : Math.min(5, Math.max(1, n))
}

function notifyModsOfPending(communityId: string | null, body: string, edited: boolean) {
  void (async () => {
    const s = await scopeInfo(communityId)
    const emails = await modEmailsFor(communityId)
    const snippet = body.length > 140 ? body.slice(0, 140) + '…' : body
    const subject = edited
      ? `An edited review needs re-approval for ${s.name}`
      : `New review awaiting approval for ${s.name}`
    for (const to of emails) await sendEmail(to, subject, reviewSubmittedHtml(s.name, s.reviewPath, snippet))
  })()
}

// ─── actions ───────────────────────────────────────────────────────────────────

export async function submitReview(communityId: string | null, slug: string | null, formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()

  let isMod = false
  if (communityId) {
    const access = await communityAccess(communityId, user.id)
    if (!access.isActiveMember && !access.isMod) return { error: 'You must be an active member to leave a review' }
    isMod = access.isMod
  } else {
    isMod = await isPlatformMod(user.id)
  }

  const body = (formData.get('body') as string)?.trim()
  if (!body) return { error: 'Review cannot be empty' }
  const rating = parseRating(formData)

  // One review per author per scope.
  const base = admin.from('reviews').select('id').eq('author_id', user.id)
  const { data: existing } = await (communityId ? base.eq('community_id', communityId) : base.is('community_id', null)).maybeSingle()
  if (existing) return { error: 'You already have a review here — edit it instead.' }

  const autoPublish = isMod
  const { data: inserted, error } = await admin.from('reviews').insert({
    community_id: communityId,
    author_id: user.id,
    rating,
    body,
    status: autoPublish ? 'published' : 'pending',
    approved_by: autoPublish ? user.id : null,
    published_at: autoPublish ? new Date().toISOString() : null,
  }).select('id').single()

  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: autoPublish ? 'review.created' : 'review.submitted', targetId: inserted.id, targetType: 'review' })

  if (!autoPublish) notifyModsOfPending(communityId, body, false)

  revalidateFor(communityId, slug)
  return { status: autoPublish ? 'published' : 'pending' }
}

export async function editReview(reviewId: string, communityId: string | null, slug: string | null, formData: FormData) {
  const user = await getUser()
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: r } = await admin.from('reviews').select('author_id').eq('id', reviewId).single()
  if (!r) return { error: 'Review not found' }
  if (r.author_id !== user.id) return { error: 'You can only edit your own review' }

  const body = (formData.get('body') as string)?.trim()
  if (!body) return { error: 'Review cannot be empty' }
  const rating = parseRating(formData)

  // Editing re-queues for approval and drops the review from all public display.
  await admin.from('reviews').update({
    body,
    rating,
    status: 'pending',
    is_featured: false,
    approved_by: null,
    published_at: null,
  }).eq('id', reviewId)

  logAction({ actorId: user.id, communityId, action: 'review.edited', targetId: reviewId, targetType: 'review' })
  notifyModsOfPending(communityId, body, true)

  revalidateFor(communityId, slug)
  return { status: 'pending' }
}

export async function approveReview(reviewId: string, communityId: string | null, slug: string | null) {
  const user = await getUser()
  if (!user) return { error: 'Not logged in' }
  if (!(await requireMod(communityId, user.id))) return { error: 'Not authorized' }

  const admin = createAdminClient()
  await admin.from('reviews').update({
    status: 'published',
    approved_by: user.id,
    published_at: new Date().toISOString(),
  }).eq('id', reviewId)

  logAction({ actorId: user.id, communityId, action: 'review.approved', targetId: reviewId, targetType: 'review' })
  revalidateFor(communityId, slug)
  return {}
}

export async function rejectReview(reviewId: string, communityId: string | null, slug: string | null) {
  const user = await getUser()
  if (!user) return { error: 'Not logged in' }
  if (!(await requireMod(communityId, user.id))) return { error: 'Not authorized' }

  const admin = createAdminClient()
  await admin.from('reviews').update({ status: 'rejected', is_featured: false }).eq('id', reviewId)
  logAction({ actorId: user.id, communityId, action: 'review.rejected', targetId: reviewId, targetType: 'review' })
  revalidateFor(communityId, slug)
  return {}
}

export async function toggleFeatureReview(reviewId: string, communityId: string | null, slug: string | null) {
  const user = await getUser()
  if (!user) return { error: 'Not logged in' }
  if (!(await requireMod(communityId, user.id))) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: r } = await admin.from('reviews').select('status, is_featured, author_id').eq('id', reviewId).single()
  if (!r) return { error: 'Review not found' }
  if (r.status !== 'published') return { error: 'Approve the review before featuring it' }

  const next = !r.is_featured
  await admin.from('reviews').update({ is_featured: next }).eq('id', reviewId)
  logAction({ actorId: user.id, communityId, action: next ? 'review.featured' : 'review.unfeatured', targetId: reviewId, targetType: 'review' })

  if (next) {
    void (async () => {
      const s = await scopeInfo(communityId)
      const to = await emailFor(r.author_id)
      if (to) await sendEmail(to, 'Your review is now featured', reviewFeaturedHtml(s.name, s.viewPath))
    })()
  }

  revalidateFor(communityId, slug)
  return {}
}

export async function deleteReview(reviewId: string, communityId: string | null, slug: string | null): Promise<{ error?: string }> {
  const user = await getUser()
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: r } = await admin.from('reviews').select('author_id').eq('id', reviewId).single()
  if (!r) return { error: 'Review not found' }

  const isAuthor = r.author_id === user.id
  const isMod = await requireMod(communityId, user.id)
  if (!isAuthor && !isMod) return { error: 'Not authorized' }

  await admin.from('reviews').delete().eq('id', reviewId)
  logAction({ actorId: user.id, communityId, action: 'review.deleted', targetId: reviewId, targetType: 'review' })
  revalidateFor(communityId, slug)
  return {}
}
