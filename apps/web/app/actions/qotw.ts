'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'
import { findQotwCategoryId, QOTW_TEST_NUMBER } from '@/lib/qotw'

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

  const { data: cats } = await admin.from('kb_categories').select('id, name').eq('community_id', communityId)
  const qotwCategoryId = findQotwCategoryId(cats ?? [])
  if (!qotwCategoryId) return { error: 'Create a “Question of the Week” category first (Q&A categories in settings).' }

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
