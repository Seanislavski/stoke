'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'

async function requirePlatformStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data } = await supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle()
  if (!data) throw new Error('Forbidden')
  return user
}

export async function addTicketCategory(formData: FormData): Promise<{ error?: string }> {
  const actor = await requirePlatformStaff()

  const label = (formData.get('label') as string ?? '').trim()
  if (!label) return { error: 'Label is required' }

  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!key) return { error: 'Invalid label — use letters and numbers' }

  const admin = createAdminClient()
  const { data: top } = await admin
    .from('ticket_categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
  const nextPosition = (top?.[0]?.position ?? -1) + 1

  const { error } = await admin.from('ticket_categories').insert({ key, label, position: nextPosition, is_active: true })
  if (error) {
    if (error.code === '23505') return { error: 'A category with that name already exists' }
    return { error: error.message }
  }

  void logAction({ actorId: actor.id, action: 'ticket_category.created', targetId: key, targetType: 'ticket_category', metadata: { label } })

  revalidatePath('/admin/support')
  revalidatePath('/support')
  return {}
}

export async function deleteTicketCategory(key: string): Promise<{ error?: string }> {
  const actor = await requirePlatformStaff()
  const admin = createAdminClient()
  const { data: cat } = await admin.from('ticket_categories').select('label').eq('key', key).single()
  const { error } = await admin.from('ticket_categories').delete().eq('key', key)
  if (error) return { error: error.message }

  void logAction({ actorId: actor.id, action: 'ticket_category.deleted', targetId: key, targetType: 'ticket_category', metadata: { label: cat?.label } })

  revalidatePath('/admin/support')
  revalidatePath('/support')
  return {}
}

export async function toggleTicketCategory(key: string, isActive: boolean): Promise<void> {
  const actor = await requirePlatformStaff()
  const admin = createAdminClient()
  const { data: cat } = await admin.from('ticket_categories').select('label').eq('key', key).single()
  await admin.from('ticket_categories').update({ is_active: isActive }).eq('key', key)

  void logAction({ actorId: actor.id, action: isActive ? 'ticket_category.enabled' : 'ticket_category.disabled', targetId: key, targetType: 'ticket_category', metadata: { label: cat?.label } })

  revalidatePath('/admin/support')
  revalidatePath('/support')
}
