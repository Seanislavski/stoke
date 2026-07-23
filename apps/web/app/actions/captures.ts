'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'

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
    .select('id, content, consent_status, discord_author_name, question_id, answer_id, claimed_by')
    .eq('id', captureId)
    .eq('community_id', communityId)
    .single()
  if (!capture) return { capture: null, error: 'Capture not found' }
  if (!['granted_credited', 'granted_anon'].includes(capture.consent_status)) {
    return { capture: null, error: 'The author has not granted permission for this capture' }
  }
  if (capture.question_id || capture.answer_id) {
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
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/moderation`)
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
    .select('id, question_id, answer_id')
    .eq('id', captureId).eq('community_id', communityId).single()
  if (!capture) return { error: 'Capture not found' }
  if (capture.question_id || capture.answer_id) return { error: 'Already published — delete the content itself instead' }

  await admin.from('discord_captures').delete().eq('id', captureId)
  logAction({ actorId: user.id, communityId, action: 'capture.discarded', targetId: captureId, targetType: 'capture' })
  revalidatePath(`/communities/${slug}/moderation`)
  return {}
}

// ─── the claim funnel ──────────────────────────────────────────────────────────
// The claim token was only ever sent to the original author's Discord DM/mention,
// so possession of it is the identity proof. Claiming re-attributes published
// content to the claimer's real Stoke profile (or pre-registers them as the
// author if the capture hasn't been filed yet).

export async function claimCapture(token: string): Promise<{ error?: string; slug?: string; questionId?: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: capture } = await admin
    .from('discord_captures')
    .select('id, community_id, consent_status, claimed_by, question_id, answer_id')
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
  if (capture.answer_id) {
    await admin.from('kb_answers')
      .update({ author_id: user.id, attribution: null })
      .eq('id', capture.answer_id)
  } else if (capture.question_id) {
    await admin.from('kb_questions')
      .update({ asker_id: user.id, attribution: null })
      .eq('id', capture.question_id)
  }

  logAction({
    actorId: user.id, communityId: capture.community_id, action: 'capture.claimed',
    targetId: capture.id, targetType: 'capture',
  })
  if (community?.slug) {
    revalidatePath(`/communities/${community.slug}`)
    if (capture.question_id) revalidatePath(`/communities/${community.slug}/questions/${capture.question_id}`)
  }
  return { slug: community?.slug, questionId: capture.question_id }
}
