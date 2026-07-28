'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'
import { qotwLabel, QOTW_TEST_NUMBER } from '@/lib/qotw'
import { ensureQotwCategory } from '@/lib/qotw-publish'
import { sendEmail, qotwChosenHtml } from '@/lib/email'
import { enqueueDiscordDm, APP_URL } from '@/lib/discord-outbox'

async function requireMod(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, allowed: false, ownerId: null as string | null }

  const admin = createAdminClient()
  const [{ data: membership }, { data: community }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isOwner = user.id === community?.owner_id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  return { user, allowed: isOwner || isMod || !!platformRole, ownerId: community?.owner_id ?? null }
}

function revalidate(slug: string) {
  revalidatePath(`/communities/${slug}/qotw`)
  revalidatePath(`/communities/${slug}`)
}

export async function addDraft(communityId: string, slug: string, formData: FormData) {
  const { user, allowed } = await requireMod(communityId)
  if (!user || !allowed) return { error: 'Not authorized' }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'A question is required' }

  const admin = createAdminClient()
  const { data: last } = await admin
    .from('qotw_items').select('position')
    .eq('community_id', communityId).is('number', null)
    .order('position', { ascending: false }).limit(1).maybeSingle()
  const position = (last?.position ?? -1) + 1

  const planned = (formData.get('planned_for') as string)?.trim()
  const { error } = await admin.from('qotw_items').insert({
    community_id: communityId,
    title,
    body: (formData.get('body') as string)?.trim() || null,
    planned_for: planned || null,
    position,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  revalidate(slug)
  return { ok: true }
}

export async function updateDraft(itemId: string, communityId: string, slug: string, formData: FormData) {
  const { allowed } = await requireMod(communityId)
  if (!allowed) return { error: 'Not authorized' }

  const title = (formData.get('title') as string)?.trim()
  if (!title) return { error: 'A question is required' }

  const admin = createAdminClient()
  const planned = (formData.get('planned_for') as string)?.trim()
  const { error } = await admin.from('qotw_items').update({
    title,
    body: (formData.get('body') as string)?.trim() || null,
    planned_for: planned || null,
  }).eq('id', itemId).eq('community_id', communityId).is('number', null) // only drafts are editable
  if (error) return { error: error.message }
  revalidate(slug)
  return { ok: true }
}

/**
 * Reorder the bank queue. `orderedIds` is the full ordered list of draft ids
 * (top = next up); positions are renumbered 0..n to match. Only affects drafts
 * (number is null) — published items are excluded by the guard.
 */
export async function reorderBank(communityId: string, slug: string, orderedIds: string[]) {
  const { allowed } = await requireMod(communityId)
  if (!allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      admin.from('qotw_items').update({ position: i })
        .eq('id', id).eq('community_id', communityId).is('number', null)
    )
  )
  const failed = results.find(r => r.error)
  if (failed?.error) return { error: failed.error.message }
  revalidate(slug)
  return { ok: true }
}

export async function deleteItem(itemId: string, communityId: string, slug: string) {
  const { user, allowed } = await requireMod(communityId)
  if (!user || !allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('qotw_items').select('question_id')
    .eq('id', itemId).eq('community_id', communityId).maybeSingle()

  await admin.from('qotw_items').delete().eq('id', itemId).eq('community_id', communityId)
  // Published items own a kb_question (and its answers) — remove it too.
  if (item?.question_id) await admin.from('kb_questions').delete().eq('id', item.question_id)

  logAction({ actorId: user.id, communityId, action: 'qotw.deleted', targetId: itemId, targetType: 'qotw' })
  revalidate(slug)
  return { ok: true }
}

/**
 * Promote an EXISTING member-submitted question to the next Question of the Week —
 * in place, so the original asker keeps authorship (no clone). Assigns the next QotW
 * number, files it into the QotW category (approving/publishing it if still pending),
 * and creates a qotw_items row linked to that question so it gets the permanent /qotw/N
 * link and becomes the spotlight.
 */
export async function publishExistingQuestion(questionId: string, communityId: string, slug: string) {
  const { user, allowed } = await requireMod(communityId)
  if (!user || !allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: question } = await admin
    .from('kb_questions').select('id, title, body, status, asker_id')
    .eq('id', questionId).eq('community_id', communityId).maybeSingle()
  if (!question) return { error: 'Question not found' }

  // Already a QotW? (has a qotw_items row pointing at it)
  const { data: existingItem } = await admin
    .from('qotw_items').select('id, number')
    .eq('community_id', communityId).eq('question_id', questionId).maybeSingle()
  if (existingItem) return { error: 'This question is already a Question of the Week.' }

  const qotwCategoryId = await ensureQotwCategory(admin, communityId, user.id)
  if (!qotwCategoryId) return { error: 'Could not set up the Question of the Week category.' }

  // Next real number (test sentinel 0 never inflates the count).
  const { data: maxRow } = await admin
    .from('qotw_items').select('number')
    .eq('community_id', communityId).gt('number', 0)
    .order('number', { ascending: false }).limit(1).maybeSingle()
  const nextNumber = (maxRow?.number ?? 0) + 1

  const now = new Date().toISOString()
  // Move it into the QotW category; publish it if it wasn't already. Authorship untouched.
  const questionUpdate: Record<string, unknown> = { category_id: qotwCategoryId }
  if (question.status !== 'published') {
    questionUpdate.status = 'published'
    questionUpdate.approved_by = user.id
    questionUpdate.published_at = now
  }
  const { error: qErr } = await admin.from('kb_questions').update(questionUpdate).eq('id', questionId)
  if (qErr) return { error: qErr.message }

  const { error: insErr } = await admin.from('qotw_items').insert({
    community_id: communityId,
    title: question.title,
    body: question.body,
    number: nextNumber,
    question_id: questionId,
    created_by: user.id,
    published_at: now,
  })
  if (insErr) return { error: insErr.message }

  // Who actually hears about this? A question filed from an UNCLAIMED Discord
  // capture is authored by the Silas system user, so `asker_id` is a bot mailbox —
  // congratulating it would send the best moment in the funnel to nobody while the
  // human who wrote it hears nothing. Those go to the original Discord author via
  // the outbox Silas drains, which doubles as a nudge to claim the post. Once a
  // capture IS claimed, asker_id is the claimer's real profile and the normal
  // in-app path below is correct.
  const { data: capture } = await admin
    .from('discord_captures')
    .select('id, discord_author_id, consent_status, claim_token, claimed_by')
    .eq('question_id', questionId).eq('community_id', communityId).maybeSingle()

  if (capture && !capture.claimed_by) {
    const { data: c } = await admin.from('communities').select('name, slug').eq('id', communityId).single()
    if (c) {
      await enqueueDiscordDm({
        communityId,
        kind: 'qotw_chosen',
        discordUserId: capture.discord_author_id,
        captureId: capture.id,
        payload: {
          community_name: c.name,
          question_title: question.title,
          qotw_label: qotwLabel(nextNumber),
          // The NUMBERED link, not the question link: the recipient is very
          // likely logged out, and middleware rewrites /qotw/N to the public
          // preview. /questions/{id} would gate them instead.
          qotw_url: `${APP_URL}/communities/${c.slug}/qotw/${nextNumber}`,
          // An anonymous consent gets the congratulations but no claim link —
          // claiming would put their name on it, which is the opposite of what
          // they asked for.
          claim_url: capture.consent_status === 'granted_credited' && capture.claim_token
            ? `${APP_URL}/claim/${capture.claim_token}`
            : null,
        },
      })
    }
  } else if (question.asker_id && question.asker_id !== user.id) {
    // Congratulate the asker (unless they promoted their own question) — bell + email.
    const askerId = question.asker_id
    await admin.from('notifications').insert({
      user_id: askerId,
      type: 'qotw',
      actor_id: user.id,
      community_id: communityId,
      message_id: questionId,
    })
    void (async () => {
      const [{ data: userData }, { data: c }] = await Promise.all([
        admin.auth.admin.getUserById(askerId),
        admin.from('communities').select('name, slug').eq('id', communityId).single(),
      ])
      const to = userData.user?.email
      if (to && c) {
        await sendEmail(to, `Your question is the Question of the Week in ${c.name}`, qotwChosenHtml(c.name, c.slug, questionId, question.title, qotwLabel(nextNumber)))
      }
    })()
  }

  logAction({ actorId: user.id, communityId, action: 'qotw.published', targetId: questionId, targetType: 'qotw' })
  revalidate(slug)
  revalidatePath(`/communities/${slug}/questions/${questionId}`)
  return { ok: true, number: nextNumber }
}

/**
 * Publish a draft as the next Question of the Week: assigns the community's next
 * QotW number and creates the answerable kb_question in the "Question of the Week"
 * category. Newest published QotW is what the Q&A spotlight surfaces.
 */
export async function publishItem(itemId: string, communityId: string, slug: string, asTest = false) {
  const { user, allowed } = await requireMod(communityId)
  if (!user || !allowed) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: item } = await admin
    .from('qotw_items').select('id, title, body, number')
    .eq('id', itemId).eq('community_id', communityId).maybeSingle()
  if (!item) return { error: 'Not found' }
  if (item.number != null) return { error: 'Already published' }

  const qotwCategoryId = await ensureQotwCategory(admin, communityId, user.id)
  if (!qotwCategoryId) return { error: 'Could not set up the Question of the Week category.' }

  const { data: community } = await admin.from('communities').select('owner_id').eq('id', communityId).single()
  const authorId = community?.owner_id ?? user.id

  let nextNumber: number
  if (asTest) {
    const { data: existingTest } = await admin.from('qotw_items')
      .select('id').eq('community_id', communityId).eq('number', QOTW_TEST_NUMBER).maybeSingle()
    if (existingTest) return { error: 'A test (QotW-t) already exists — delete it first.' }
    nextNumber = QOTW_TEST_NUMBER
  } else {
    // Real numbers are always > 0, so the sentinel test (0) never inflates the count.
    const { data: maxRow } = await admin
      .from('qotw_items').select('number')
      .eq('community_id', communityId).gt('number', 0)
      .order('number', { ascending: false }).limit(1).maybeSingle()
    nextNumber = (maxRow?.number ?? 0) + 1
  }

  const now = new Date().toISOString()
  const { data: q, error: qErr } = await admin.from('kb_questions').insert({
    community_id: communityId,
    category_id: qotwCategoryId,
    asker_id: authorId,
    title: item.title,
    body: item.body,
    status: 'published',
    approved_by: authorId,
    published_at: now,
  }).select('id').single()
  if (qErr) return { error: qErr.message }

  if (asTest) {
    // A test is a throwaway COPY — the original draft stays in the bank, so deleting
    // QotW-t only removes the copy and never costs you the question.
    const { error: insErr } = await admin.from('qotw_items').insert({
      community_id: communityId,
      title: item.title,
      body: item.body,
      number: nextNumber, // QOTW_TEST_NUMBER (0)
      question_id: q.id,
      created_by: user.id,
      published_at: now,
    })
    if (insErr) {
      await admin.from('kb_questions').delete().eq('id', q.id) // don't orphan the question
      return { error: insErr.message }
    }
  } else {
    // A real publish consumes the draft in place.
    const { error: upErr } = await admin.from('qotw_items')
      .update({ number: nextNumber, question_id: q.id, published_at: now })
      .eq('id', itemId)
    if (upErr) return { error: upErr.message }
  }

  logAction({ actorId: user.id, communityId, action: 'qotw.published', targetId: q.id, targetType: 'qotw' })
  revalidate(slug)
  return { ok: true, number: nextNumber, questionId: q.id }
}
