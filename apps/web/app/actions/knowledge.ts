'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'
import { sendEmail, kbQuestionSubmittedHtml, kbQuestionApprovedHtml, kbAnswerSubmittedHtml, kbAnswerApprovedHtml } from '@/lib/email'

// ─── helpers ───────────────────────────────────────────────────────────────────

async function getMembershipOrThrow(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, membership: null }

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('community_members')
    .select('role, status')
    .eq('community_id', communityId)
    .eq('user_id', user.id)
    .maybeSingle()

  return { user, membership }
}

async function requireModAccess(communityId: string, userId: string, membership: { role: string; status: string } | null) {
  const admin = createAdminClient()
  const [{ data: community }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', userId).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isOwner = userId === community?.owner_id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isPlatformStaff = !!platformRole
  return { allowed: isMod || isOwner || isPlatformStaff }
}

async function modEmails(communityId: string) {
  const admin = createAdminClient()
  const [{ data: community }, { data: mods }] = await Promise.all([
    admin.from('communities').select('owner_id, name, slug').eq('id', communityId).single(),
    admin.from('community_members').select('user_id').eq('community_id', communityId).eq('status', 'active').in('role', ['organizer', 'moderator']),
  ])
  if (!community) return { community: null, emails: [] as string[] }
  const ids = new Set<string>([community.owner_id, ...(mods ?? []).map(m => m.user_id)])
  const emails: string[] = []
  for (const id of ids) {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data.user?.email) emails.push(data.user.email)
  }
  return { community, emails }
}

async function emailFor(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

// ─── questions ───────────────────────────────────────────────────────────────────

export async function submitQuestion(communityId: string, slug: string, formData: FormData) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: community } = await admin.from('communities').select('owner_id, name').eq('id', communityId).single()
  const isOwner = user.id === community?.owner_id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isActiveMember = membership?.status === 'active'

  if (!isActiveMember && !isOwner) return { error: 'Must be an active member to ask a question' }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'Question title is required' }

  const autoPublish = isMod || isOwner
  // Asker's public-sharing preference (checkbox, checked by default). A signal for mods,
  // not an auto-publish — the mod-controlled is_public toggle still governs actual visibility.
  const askerPublicPref = formData.get('public_ok') === 'on'
  const { data: inserted, error } = await admin.from('kb_questions').insert({
    community_id: communityId,
    asker_id: user.id,
    title,
    body: (formData.get('body') as string)?.trim() || null,
    category_id: autoPublish ? ((formData.get('category_id') as string) || null) : null,
    status: autoPublish ? 'published' : 'pending',
    approved_by: autoPublish ? user.id : null,
    published_at: autoPublish ? new Date().toISOString() : null,
    asker_public_pref: askerPublicPref,
  }).select('id').single()

  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: autoPublish ? 'question.created' : 'question.submitted', targetId: inserted.id, targetType: 'question' })

  if (!autoPublish) {
    void (async () => {
      const { community: c, emails } = await modEmails(communityId)
      if (!c) return
      for (const to of emails) await sendEmail(to, `New question awaiting review in ${c.name}`, kbQuestionSubmittedHtml(c.name, c.slug, title))
    })()
  }

  revalidatePath(`/communities/${slug}`)
  return { status: autoPublish ? 'published' : 'pending' }
}

export async function approveQuestion(questionId: string, communityId: string, slug: string, categoryId: string | null) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: q } = await admin.from('kb_questions').select('asker_id, title').eq('id', questionId).single()
  await admin.from('kb_questions').update({
    status: 'published',
    category_id: categoryId,
    approved_by: user.id,
    published_at: new Date().toISOString(),
  }).eq('id', questionId)
  logAction({ actorId: user.id, communityId, action: 'question.approved', targetId: questionId, targetType: 'question' })

  if (q) {
    void (async () => {
      const [to, { data: c }] = await Promise.all([
        emailFor(q.asker_id),
        admin.from('communities').select('name, slug').eq('id', communityId).single(),
      ])
      if (to && c) await sendEmail(to, `Your question was published in ${c.name}`, kbQuestionApprovedHtml(c.name, c.slug, questionId, q.title))
    })()
  }

  revalidatePath(`/communities/${slug}`)
  return {}
}

export async function setQuestionCategory(questionId: string, communityId: string, slug: string, categoryId: string | null) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  await admin.from('kb_questions')
    .update({ category_id: categoryId })
    .eq('id', questionId)
    .eq('community_id', communityId)
  logAction({ actorId: user.id, communityId, action: 'question.recategorized', targetId: questionId, targetType: 'question' })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/questions/${questionId}`)
  return {}
}

// Toggle whether a published question is readable by logged-out visitors (shareable by
// link). Private by default; mods flip it on per question. Only applies to published
// questions — pending/rejected are never public.
export async function setQuestionPublic(questionId: string, communityId: string, slug: string, isPublic: boolean) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  await admin.from('kb_questions')
    .update({ is_public: isPublic })
    .eq('id', questionId)
    .eq('community_id', communityId)
  logAction({ actorId: user.id, communityId, action: isPublic ? 'question.made_public' : 'question.made_private', targetId: questionId, targetType: 'question' })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/questions/${questionId}`)
  return {}
}

export async function rejectQuestion(questionId: string, communityId: string, slug: string) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  await admin.from('kb_questions').update({ status: 'rejected' }).eq('id', questionId)
  logAction({ actorId: user.id, communityId, action: 'question.rejected', targetId: questionId, targetType: 'question' })
  revalidatePath(`/communities/${slug}`)
  return {}
}

export async function deleteQuestion(questionId: string, communityId: string, slug: string): Promise<{ error?: string }> {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  // A QotW question owns a qotw_items row (FK is ON DELETE SET NULL, so deleting the
  // question alone would leave that row orphaned with a dead /qotw/N link). Remove it too
  // so the two delete paths stay consistent with the QotW manager's own deleteItem.
  await admin.from('qotw_items').delete().eq('community_id', communityId).eq('question_id', questionId)
  // If this question came from a Discord capture, dismiss that capture (keep its
  // consent record, but don't let the FK SET NULL bounce it back into the queue).
  await admin.from('discord_captures').update({ dismissed_at: new Date().toISOString() })
    .eq('community_id', communityId).eq('question_id', questionId)
  await admin.from('kb_questions').delete().eq('id', questionId)
  logAction({ actorId: user.id, communityId, action: 'question.deleted', targetId: questionId, targetType: 'question' })
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/qotw`)
  return {}
}

// Edit a question's title/body. The asker edits their own; a member's edit to an already
// published question sends it back through review. Mods edit in place (stays published).
// A QotW question is edit-locked to mods so a member can't pull a live/numbered QotW back
// into the review queue.
export async function editQuestion(questionId: string, communityId: string, slug: string, formData: FormData) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: q } = await admin.from('kb_questions').select('asker_id, status').eq('id', questionId).eq('community_id', communityId).single()
  if (!q) return { error: 'Question not found' }
  const { allowed: isMod } = await requireModAccess(communityId, user.id, membership)
  const isAsker = q.asker_id === user.id
  const { data: qotw } = await admin.from('qotw_items').select('id').eq('community_id', communityId).eq('question_id', questionId).maybeSingle()
  const isQotw = !!qotw

  const canEdit = isMod || (isAsker && !isQotw)
  if (!canEdit) return { error: 'Not authorized' }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'Question title is required' }
  const body = (formData.get('body') as string)?.trim() || null

  // Member edit to published content → back to review; mod edit stays live.
  const requeue = !isMod && q.status !== 'pending'
  const update: Record<string, unknown> = { title, body }
  if (requeue) {
    update.status = 'pending'
    update.approved_by = null
    update.published_at = null
  }
  const { error } = await admin.from('kb_questions').update(update).eq('id', questionId)
  if (error) return { error: error.message }

  logAction({ actorId: user.id, communityId, action: 'question.edited', targetId: questionId, targetType: 'question', metadata: { requeued: requeue } })

  if (requeue) {
    void (async () => {
      const { community: c, emails } = await modEmails(communityId)
      if (!c) return
      for (const to of emails) await sendEmail(to, `An edited question awaits review in ${c.name}`, kbQuestionSubmittedHtml(c.name, c.slug, title))
    })()
  }

  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/questions/${questionId}`)
  return { requeued: requeue }
}

// ─── answers ────────────────────────────────────────────────────────────────────

export async function submitAnswer(questionId: string, communityId: string, slug: string, formData: FormData) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: community } = await admin.from('communities').select('owner_id').eq('id', communityId).single()
  const isOwner = user.id === community?.owner_id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  const isActiveMember = membership?.status === 'active'

  if (!isActiveMember && !isOwner) return { error: 'Must be an active member to answer' }

  const body = (formData.get('body') as string)?.trim()
  if (!body) return { error: 'Answer cannot be empty' }

  const autoPublish = isMod || isOwner
  const { data: inserted, error } = await admin.from('kb_answers').insert({
    question_id: questionId,
    community_id: communityId,
    author_id: user.id,
    body,
    url: (formData.get('url') as string)?.trim() || null,
    status: autoPublish ? 'published' : 'pending',
    approved_by: autoPublish ? user.id : null,
    published_at: autoPublish ? new Date().toISOString() : null,
  }).select('id').single()

  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: autoPublish ? 'answer.created' : 'answer.submitted', targetId: inserted.id, targetType: 'answer', metadata: { question_id: questionId } })

  if (!autoPublish) {
    void (async () => {
      const { community: c, emails } = await modEmails(communityId)
      const { data: q } = await admin.from('kb_questions').select('title').eq('id', questionId).single()
      if (!c || !q) return
      for (const to of emails) await sendEmail(to, `New answer awaiting review in ${c.name}`, kbAnswerSubmittedHtml(c.name, c.slug, questionId, q.title))
    })()
  }

  revalidatePath(`/communities/${slug}/questions/${questionId}`)
  return { status: autoPublish ? 'published' : 'pending' }
}

export async function approveAnswer(answerId: string, communityId: string, slug: string) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: a } = await admin.from('kb_answers').select('author_id, question_id').eq('id', answerId).single()
  await admin.from('kb_answers').update({ status: 'published', approved_by: user.id, published_at: new Date().toISOString() }).eq('id', answerId)
  logAction({ actorId: user.id, communityId, action: 'answer.approved', targetId: answerId, targetType: 'answer', metadata: a ? { question_id: a.question_id } : undefined })

  if (a) {
    void (async () => {
      const [to, { data: q }, { data: c }] = await Promise.all([
        emailFor(a.author_id),
        admin.from('kb_questions').select('title').eq('id', a.question_id).single(),
        admin.from('communities').select('name, slug').eq('id', communityId).single(),
      ])
      if (to && q && c) await sendEmail(to, `Your answer was published in ${c.name}`, kbAnswerApprovedHtml(c.name, c.slug, a.question_id, q.title))
    })()
    revalidatePath(`/communities/${slug}/questions/${a.question_id}`)
  }
  revalidatePath(`/communities/${slug}`)
  return {}
}

export async function rejectAnswer(answerId: string, communityId: string, slug: string) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: a } = await admin.from('kb_answers').select('question_id').eq('id', answerId).single()
  await admin.from('kb_answers').update({ status: 'rejected' }).eq('id', answerId)
  logAction({ actorId: user.id, communityId, action: 'answer.rejected', targetId: answerId, targetType: 'answer' })
  if (a) revalidatePath(`/communities/${slug}/questions/${a.question_id}`)
  return {}
}

export async function deleteAnswer(answerId: string, communityId: string, slug: string): Promise<{ error?: string }> {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: a } = await admin.from('kb_answers').select('question_id').eq('id', answerId).single()
  // If this answer came from a Discord capture, dismiss that capture (keep its
  // consent record, but don't let the FK SET NULL bounce it back into the queue).
  await admin.from('discord_captures').update({ dismissed_at: new Date().toISOString() })
    .eq('community_id', communityId).eq('answer_id', answerId)
  await admin.from('kb_answers').delete().eq('id', answerId)
  logAction({ actorId: user.id, communityId, action: 'answer.deleted', targetId: answerId, targetType: 'answer' })
  if (a) revalidatePath(`/communities/${slug}/questions/${a.question_id}`)
  return {}
}

// Edit an answer's body/link. Author-only. A member editing their own already-published
// answer sends it back through review (and clears any accepted mark); a mod's edit stays
// live.
export async function editAnswer(answerId: string, communityId: string, slug: string, formData: FormData) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: a } = await admin.from('kb_answers').select('author_id, question_id, status').eq('id', answerId).eq('community_id', communityId).single()
  if (!a) return { error: 'Answer not found' }
  if (a.author_id !== user.id) return { error: 'Not authorized' }
  const { allowed: isMod } = await requireModAccess(communityId, user.id, membership)

  const body = (formData.get('body') as string)?.trim()
  if (!body) return { error: 'Answer cannot be empty' }
  const url = (formData.get('url') as string)?.trim() || null

  const requeue = !isMod && a.status !== 'pending'
  const update: Record<string, unknown> = { body, url }
  if (requeue) {
    update.status = 'pending'
    update.approved_by = null
    update.published_at = null
    update.is_accepted = false
  }
  const { error } = await admin.from('kb_answers').update(update).eq('id', answerId)
  if (error) return { error: error.message }

  logAction({ actorId: user.id, communityId, action: 'answer.edited', targetId: answerId, targetType: 'answer', metadata: { question_id: a.question_id, requeued: requeue } })

  if (requeue) {
    void (async () => {
      const { community: c, emails } = await modEmails(communityId)
      const { data: q } = await admin.from('kb_questions').select('title').eq('id', a.question_id).single()
      if (!c || !q) return
      for (const to of emails) await sendEmail(to, `An edited answer awaits review in ${c.name}`, kbAnswerSubmittedHtml(c.name, c.slug, a.question_id, q.title))
    })()
  }

  revalidatePath(`/communities/${slug}/questions/${a.question_id}`)
  revalidatePath(`/communities/${slug}`)
  return { requeued: requeue }
}

// Accept / unaccept an answer — askers and mods. One accepted answer per question.
export async function toggleAcceptAnswer(answerId: string, questionId: string, communityId: string, slug: string) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: q } = await admin.from('kb_questions').select('asker_id').eq('id', questionId).single()
  const isAsker = q?.asker_id === user.id
  const { allowed: isMod } = await requireModAccess(communityId, user.id, membership)
  if (!isAsker && !isMod) return { error: 'Only the asker or a moderator can mark the accepted answer' }

  const { data: current } = await admin.from('kb_answers').select('is_accepted').eq('id', answerId).single()
  const nextAccepted = !current?.is_accepted

  // Clear any existing accepted answer on this question, then set this one.
  await admin.from('kb_answers').update({ is_accepted: false }).eq('question_id', questionId)
  if (nextAccepted) {
    await admin.from('kb_answers').update({ is_accepted: true }).eq('id', answerId)
    logAction({ actorId: user.id, communityId, action: 'answer.accepted', targetId: answerId, targetType: 'answer', metadata: { question_id: questionId } })
  }

  revalidatePath(`/communities/${slug}/questions/${questionId}`)
  return {}
}

// ─── categories ──────────────────────────────────────────────────────────────────

export async function createKbCategory(communityId: string, slug: string, formData: FormData) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Category name is required' }

  const admin = createAdminClient()
  const { count } = await admin.from('kb_categories').select('*', { count: 'exact', head: true }).eq('community_id', communityId)
  const { error } = await admin.from('kb_categories').insert({
    community_id: communityId,
    name,
    description: (formData.get('description') as string)?.trim() || null,
    position: count ?? 0,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath(`/communities/${slug}/settings`)
  revalidatePath(`/communities/${slug}`)
  return {}
}

export async function deleteKbCategory(categoryId: string, communityId: string, slug: string): Promise<{ error?: string }> {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!user) return { error: 'Not logged in' }
  const { allowed } = await requireModAccess(communityId, user.id, membership)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  // Questions in this category fall back to uncategorized (FK on delete set null).
  await admin.from('kb_categories').delete().eq('id', categoryId)
  revalidatePath(`/communities/${slug}/settings`)
  revalidatePath(`/communities/${slug}`)
  return {}
}
