import type { createAdminClient } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit'
import { findQotwCategoryId, QOTW_CATEGORY_NAME } from '@/lib/qotw'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Find the community's "Question of the Week" Q&A category, creating it if missing, so
 * organizers never have to know the magic category name — publishing just provisions it.
 */
export async function ensureQotwCategory(admin: Admin, communityId: string, userId: string): Promise<string | null> {
  const { data: cats } = await admin.from('kb_categories').select('id, name').eq('community_id', communityId)
  const existing = findQotwCategoryId(cats ?? [])
  if (existing) return existing

  const { data: last } = await admin
    .from('kb_categories').select('position')
    .eq('community_id', communityId).order('position', { ascending: false }).limit(1).maybeSingle()
  const { data: created } = await admin.from('kb_categories').insert({
    community_id: communityId,
    name: QOTW_CATEGORY_NAME,
    description: "This week's question — add your answer.",
    position: (last?.position ?? -1) + 1,
    created_by: userId,
  }).select('id').single()
  return created?.id ?? null
}

/**
 * Release a bank draft as the next real Question of the Week (number > 0), in place:
 * assigns the next number, provisions the category, creates the answerable kb_question
 * (authored by the community owner), and links the qotw_items row. Shared by the manual
 * publish action and the scheduler cron. `actorId` defaults to the owner (cron has no user).
 */
export async function releaseDraft(
  admin: Admin,
  communityId: string,
  item: { id: string; title: string; body: string | null },
  actorId?: string,
): Promise<{ number?: number; questionId?: string; error?: string }> {
  const { data: community } = await admin.from('communities').select('owner_id').eq('id', communityId).single()
  const authorId = community?.owner_id ?? actorId
  if (!authorId) return { error: 'No author available' }

  const qotwCategoryId = await ensureQotwCategory(admin, communityId, authorId)
  if (!qotwCategoryId) return { error: 'Could not set up the Question of the Week category.' }

  // Real numbers are always > 0, so the sentinel test (0) never inflates the count.
  const { data: maxRow } = await admin
    .from('qotw_items').select('number')
    .eq('community_id', communityId).gt('number', 0)
    .order('number', { ascending: false }).limit(1).maybeSingle()
  const nextNumber = (maxRow?.number ?? 0) + 1

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

  const { error: upErr } = await admin.from('qotw_items')
    .update({ number: nextNumber, question_id: q.id, published_at: now })
    .eq('id', item.id)
  if (upErr) return { error: upErr.message }

  logAction({ actorId: actorId ?? authorId, communityId, action: 'qotw.published', targetId: q.id, targetType: 'qotw' })
  return { number: nextNumber, questionId: q.id }
}
