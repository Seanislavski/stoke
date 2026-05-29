'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function submitReport(
  reportedUserId: string,
  reason: string,
  details: string,
  communityId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }
  if (user.id === reportedUserId) return { error: 'Cannot report yourself' }

  const admin = createAdminClient()
  const { error } = await admin.from('reports').insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    community_id: communityId ?? null,
    reason,
    details: details.trim() || null,
    status: 'open',
  })

  if (error) return { error: error.message }
  return {}
}

export async function resolveReport(reportId: string, communitySlug?: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('reports')
    .update({ status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId)

  if (error) return { error: error.message }
  if (communitySlug) revalidatePath(`/communities/${communitySlug}/settings`)
  revalidatePath('/admin/moderation')
  return {}
}

export async function reopenReport(reportId: string, communitySlug?: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('reports')
    .update({ status: 'open', resolved_by: null, resolved_at: null })
    .eq('id', reportId)

  if (error) return { error: error.message }
  if (communitySlug) revalidatePath(`/communities/${communitySlug}/settings`)
  revalidatePath('/admin/moderation')
  return {}
}

export async function dismissReport(reportId: string, communitySlug?: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('reports')
    .update({ status: 'dismissed', resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', reportId)

  if (error) return { error: error.message }
  if (communitySlug) revalidatePath(`/communities/${communitySlug}/settings`)
  revalidatePath('/admin/moderation')
  return {}
}
