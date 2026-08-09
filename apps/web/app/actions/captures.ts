'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction, logPhotos } from '@/lib/audit'

// The Silas! system user — captured Discord content is authored by the resident
// librarian, with an `attribution` line crediting the original Discord author
// (or "a community member" for anonymous consents). Created by
// scripts/create-silas-user.mjs.
const SILAS_USER_ID = '28184489-f70d-4943-a050-fc51e833905b'

async function requireMod(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, allowed: false }

  const admin = createAdminClient()
  const [{ data: community }, { data: membership }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const allowed =
    !!platformRole ||
    user.id === community?.owner_id ||
    ['organizer', 'moderator'].includes(membership?.role ?? '')
  return { user, allowed }
}

// Loads a capture that is ready to file: consent granted, not yet published.
async function loadFilableCapture(captureId: string, communityId: string) {
  const admin = createAdminClient()
  const { data: capture } = await admin
    .from('discord_captures')
    .select('id, content, photos, consent_status, discord_author_name, question_id, answer_id, review_id, claimed_by')
    .eq('id', captureId)
    .eq('community_id', communityId)
    .single()
  if (!capture) return { capture: null, error: 'Capture not found' }
  if (!['granted_credited', 'granted_anon'].includes(capture.consent_status)) {
    return { capture: null, error: 'The author has not granted permission for this capture' }
  }
  if (capture.question_id || capture.answer_id || capture.review_id) {
    return { capture: null, error: 'This capture has already been published' }
  }
  return { capture, error: null }
}

const attributionFor = (capture: { consent_status: string; discord_author_name: string }) =>
  capture.consent_status === 'granted_credited' ? capture.discord_author_name : 'a community member'

export async function publishCaptureAsAnswer(
  captureId: string,
  communityId: string,
  slug: string,
  questionId: string
): Promise<{ error?: string }> {
  const { user, allowed } = await requireMod(communityId)
  if (!user || !allowed) return { error: 'Not authorized' }
  if (!questionId) return { error: 'Pick a question first' }

  const { capture, error } = await loadFilableCapture(captureId, communityId)
  if (!capture) return { error: error! }

  const admin = createAdminClient()
  const { data: question } = await admin
    .from('kb_questions').select('id').eq('id', questionId).eq('community_id', communityId).eq('status', 'published').maybeSingle()
  if (!question) return { error: 'Question not found' }

  // Mod-captured = pre-approved: a moderator curated it by capturing it. If the
  // author already claimed their capture (before it was filed), it publishes
  // directly under their profile instead of Silas + attribution.
  const { data: answer, error: aErr } = await admin.from('kb_answers').insert({
    question_id: questionId,
    community_id: communityId,
    author_id: capture.claimed_by ?? SILAS_USER_ID,
    body: capture.content,
    photos: capture.photos ?? [],
    status: 'published',
    approved_by: user.id,
    published_at: new Date().toISOString(),
    attribution: capture.claimed_by ? null : attributionFor(capture),
  }).select('id').single()
  if (aErr) return { error: aErr.message }

  await admin.from('discord_captures')
    .update({ answer_id: answer.id, question_id: questionId })
    .eq('id', captureId)

  logAction({
    actorId: user.id, communityId, action: 'capture.published',
    targetId: answer.id, targetType: 'answer', metadata: { question_id: questionId, capture_id: captureId },
  })
  if (capture.photos?.length) logPhotos({ actorId: user.id, communityId, added: capture.photos, source: 'qa_answer', parentId: questionId })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/questions/${questionId}`)
  revalidatePath(`/communities/${slug}/moderation`)
  return {}
}

export async function publishCaptureAsQuestion(
  captureId: string,
  communityId: string,
  slug: string,
  title: string
): Promise<{ error?: string }> {
  const { user, allowed } = await requireMod(communityId)
  if (!user || !allowed) return { error: 'Not authorized' }
  const trimmed = title.trim()
  if (!trimmed) return { error: 'A question title is required' }

  const { capture, error } = await loadFilableCapture(captureId, communityId)
  if (!capture) return { error: error! }

  const admin = createAdminClient()
  const { data: question, error: qErr } = await admin.from('kb_questions').insert({
    community_id: communityId,
    asker_id: capture.claimed_by ?? SILAS_USER_ID,
    title: trimmed,
    body: capture.content,
    photos: capture.photos ?? [],
    status: 'published',
    approved_by: user.id,
    published_at: new Date().toISOString(),
    attribution: capture.claimed_by ? null : attributionFor(capture),
  }).select('id').single()
  if (qErr) return { error: qErr.message }

  await admin.from('discord_captures')
    .update({ question_id: question.id })
    .eq('id', captureId)

  logAction({
    actorId: user.id, communityId, action: 'capture.published',
    targetId: question.id, targetType: 'question', metadata: { capture_id: captureId },
  })
  if (capture.photos?.length) logPhotos({ actorId: user.id, communityId, added: capture.photos, source: 'qa_question', parentId: question.id })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/moderation`)
  return {}
}

// ─── testimonials ──────────────────────────────────────────────────────────────
// Same funnel as the Q&A captures, landing in `reviews` instead. Scope is the
// mod's call: a testimonial about THIS community (community_id set, surfaces on
// the community preview) or about Stoke itself (community_id null, surfaces on
// the homepage once featured). Most Discord praise is about the community —
// filing it as a platform review claims something the author never said.
export async function publishCaptureAsTestimonial(
  captureId: string,
  communityId: string,
  slug: string,
  scope: 'community' | 'platform',
  rating: number | null,
): Promise<{ error?: string }> {
  const { user, allowed } = await requireMod(communityId)
  if (!user || !allowed) return { error: 'Not authorized' }
  if (scope !== 'community' && scope !== 'platform') return { error: 'Pick a scope' }
  if (rating !== null && (rating < 1 || rating > 5)) return { error: 'Rating must be 1–5' }

  const { capture, error } = await loadFilableCapture(captureId, communityId)
  if (!capture) return { error: error! }

  const admin = createAdminClient()
  const scopeId = scope === 'platform' ? null : communityId

  // A claimed capture publishes under the member's own profile. That drops the
  // attribution, which puts the row back under the one-review-per-author-per-scope
  // unique index — so check for an existing one rather than surfacing a raw 23505.
  if (capture.claimed_by) {
    const q = admin.from('reviews').select('id').eq('author_id', capture.claimed_by).is('attribution', null)
    const { data: clash } = await (scopeId ? q.eq('community_id', scopeId) : q.is('community_id', null)).limit(1)
    if (clash?.length) {
      return { error: 'This author already has a testimonial in that scope — only one per person is allowed.' }
    }
  }

  // Mod-captured = pre-approved (the mod curated it by capturing it), but never
  // auto-featured: featuring is a separate deliberate act with a cap of 6.
  const { data: review, error: rErr } = await admin.from('reviews').insert({
    community_id: scopeId,
    author_id: capture.claimed_by ?? SILAS_USER_ID,
    body: capture.content,
    rating,
    status: 'published',
    is_featured: false,
    approved_by: user.id,
    published_at: new Date().toISOString(),
    attribution: capture.claimed_by ? null : attributionFor(capture),
    discord_capture_id: captureId,
  }).select('id').single()
  if (rErr) return { error: rErr.message }

  await admin.from('discord_captures')
    .update({ review_id: review.id, review_scope: scope })
    .eq('id', captureId)

  logAction({
    actorId: user.id, communityId, action: 'capture.published',
    targetId: review.id, targetType: 'review', metadata: { capture_id: captureId, scope },
  })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/testimonials`)
  revalidatePath(`/communities/${slug}/moderation`)
  revalidatePath(`/preview/${slug}`)
  if (scope === 'platform') {
    revalidatePath('/admin/reviews')
    revalidatePath('/')
  }
  return {}
}

// Removes an unfiled capture from the inbox. The consent record travels with the
// row, so this is only offered before publishing — published captures keep their
// row (and its consent trail) permanently.
export async function discardCapture(
  captureId: string,
  communityId: string,
  slug: string
): Promise<{ error?: string }> {
  const { user, allowed } = await requireMod(communityId)
  if (!user || !allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: capture } = await admin
    .from('discord_captures')
    .select('id, question_id, answer_id, review_id')
    .eq('id', captureId).eq('community_id', communityId).single()
  if (!capture) return { error: 'Capture not found' }
  if (capture.question_id || capture.answer_id || capture.review_id) return { error: 'Already published — delete the content itself instead' }

  await admin.from('discord_captures').delete().eq('id', captureId)
  logAction({ actorId: user.id, communityId, action: 'capture.discarded', targetId: captureId, targetType: 'capture' })
  revalidatePath(`/communities/${slug}/moderation`)
  revalidatePath(`/communities/${slug}/testimonials`)
  return {}
}

// ─── the claim funnel ──────────────────────────────────────────────────────────
// The claim token was only ever sent to the original author's Discord DM/mention,
// so possession of it is the identity proof. Claiming re-attributes published
// content to the claimer's real Stoke profile (or pre-registers them as the
// author if the capture hasn't been filed yet).

// Re-attributing a claimed testimonial is not symmetrical with a question or an
// answer. Captured reviews are exempt from the one-review-per-author-per-scope
// unique index only because they carry an `attribution`; clearing it on claim
// puts the row back under that rule, so a claimer who already reviewed this
// scope would hit a 23505. This path runs inside the Discord sign-in callback,
// where a throw would break authentication — so a clash is a no-op instead: the
// testimonial keeps its "Shared by X on Discord" credit and stays published.
async function reattributeReview(
  admin: ReturnType<typeof createAdminClient>,
  reviewId: string,
  userId: string,
): Promise<boolean> {
  const { data: review } = await admin
    .from('reviews').select('id, community_id').eq('id', reviewId).maybeSingle()
  if (!review) return false

  const q = admin.from('reviews').select('id').eq('author_id', userId).is('attribution', null).neq('id', reviewId)
  const { data: clash } = await (review.community_id
    ? q.eq('community_id', review.community_id)
    : q.is('community_id', null)).limit(1)
  if (clash?.length) return false

  const { error } = await admin.from('reviews')
    .update({ author_id: userId, attribution: null }).eq('id', reviewId)
  return !error
}

// Signing in with Discord proves the same thing the claim token proved — that
// you are the Discord account that wrote the message — except it proves it by
// identity rather than by possession of a link, so it needs no delivery and
// covers everything at once. Runs on sign-in; safe to call repeatedly.
export async function claimCapturesForDiscordUser(
  userId: string,
  discordUserId: string,
): Promise<{ claimed: number }> {
  if (!discordUserId) return { claimed: 0 }
  const admin = createAdminClient()

  const { data: captures } = await admin
    .from('discord_captures')
    .select('id, community_id, question_id, answer_id, review_id')
    .eq('discord_author_id', discordUserId)
    .is('claimed_by', null)
    // Declined captures were never published and must stay unclaimable; pending
    // ones have not been consented to yet, so neither becomes theirs here.
    .in('consent_status', ['granted_credited', 'granted_anon'])

  if (!captures?.length) return { claimed: 0 }

  const now = new Date().toISOString()
  const slugs = new Set<string>()

  for (const capture of captures) {
    await admin.from('discord_captures')
      .update({ claimed_by: userId, claimed_at: now })
      .eq('id', capture.id)
      // Guard against two concurrent sign-ins racing for the same row.
      .is('claimed_by', null)

    // Same re-attribution as the token path: the member's own name replaces the
    // "shared on Discord" credit.
    if (capture.answer_id) {
      await admin.from('kb_answers')
        .update({ author_id: userId, attribution: null })
        .eq('id', capture.answer_id)
    } else if (capture.question_id) {
      await admin.from('kb_questions')
        .update({ asker_id: userId, attribution: null })
        .eq('id', capture.question_id)
    } else if (capture.review_id) {
      await reattributeReview(admin, capture.review_id, userId)
    }

    logAction({
      actorId: userId,
      communityId: capture.community_id,
      action: 'capture.claimed',
      targetId: capture.id,
      targetType: 'capture',
      metadata: { via: 'discord-sign-in' },
    })

    const { data: community } = await admin
      .from('communities').select('slug').eq('id', capture.community_id).maybeSingle()
    if (community?.slug) slugs.add(community.slug)
  }

  for (const slug of slugs) revalidatePath(`/communities/${slug}`)
  return { claimed: captures.length }
}

export async function claimCapture(token: string): Promise<{
  error?: string
  slug?: string
  questionId?: string | null
  reviewId?: string | null
  // False only in the testimonial case where reattributeReview declined to run
  // (the claimer already has a review in that scope). The claim is still
  // recorded — but the quote keeps its Discord credit, and the page must say so
  // rather than reporting success it didn't deliver.
  credited?: boolean
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: capture } = await admin
    .from('discord_captures')
    .select('id, community_id, consent_status, claimed_by, question_id, answer_id, review_id')
    .eq('claim_token', token)
    .maybeSingle()
  if (!capture) return { error: 'This claim link isn’t valid.' }
  if (capture.consent_status === 'declined') return { error: 'This capture was declined and can’t be claimed.' }
  if (capture.claimed_by) {
    return capture.claimed_by === user.id
      ? { error: 'You’ve already claimed this — it’s yours.' }
      : { error: 'This capture has already been claimed.' }
  }

  const { data: community } = await admin
    .from('communities').select('slug').eq('id', capture.community_id).single()

  await admin.from('discord_captures')
    .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
    .eq('id', capture.id)

  // Re-attribute already-published content to the claimer's profile.
  let credited = true
  if (capture.answer_id) {
    await admin.from('kb_answers')
      .update({ author_id: user.id, attribution: null })
      .eq('id', capture.answer_id)
  } else if (capture.question_id) {
    await admin.from('kb_questions')
      .update({ asker_id: user.id, attribution: null })
      .eq('id', capture.question_id)
  } else if (capture.review_id) {
    credited = await reattributeReview(admin, capture.review_id, user.id)
  }

  logAction({
    actorId: user.id, communityId: capture.community_id, action: 'capture.claimed',
    targetId: capture.id, targetType: 'capture',
    metadata: capture.review_id ? { review_id: capture.review_id, credited } : undefined,
  })
  if (community?.slug) {
    revalidatePath(`/communities/${community.slug}`)
    if (capture.question_id) revalidatePath(`/communities/${community.slug}/questions/${capture.question_id}`)
    if (capture.review_id) revalidatePath(`/communities/${community.slug}/testimonials`)
  }
  return { slug: community?.slug, questionId: capture.question_id, reviewId: capture.review_id, credited }
}
