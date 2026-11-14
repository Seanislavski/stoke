import type { SupabaseClient } from '@supabase/supabase-js'
import { CHANGELOG } from '@/lib/changelog'

// Newest changelog date. Dates are 'YYYY-MM-DD', so string order is date order.
export function latestChangelogDate(): string | null {
  return CHANGELOG[0]?.date ?? null
}

// Sends one bell notification ('whats_new') to every opted-in member who hasn't been
// told about the newest changelog entry yet. Runs from the event-reminders cron.
// The UPDATE goes first and returns the rows it claimed, so two overlapping runs
// can never notify the same person twice.
export async function announceWhatsNew(admin: SupabaseClient): Promise<number> {
  const latest = latestChangelogDate()
  if (!latest) return 0

  const { data: claimed, error } = await admin
    .from('profiles')
    .update({ whats_new_notified: latest })
    .eq('notify_whats_new', true)
    .or(`whats_new_notified.is.null,whats_new_notified.lt.${latest}`)
    .select('id')
  if (error || !claimed || claimed.length === 0) return 0

  await admin.from('notifications').insert(
    claimed.map(p => ({ user_id: p.id, type: 'whats_new', message_id: latest })),
  )
  return claimed.length
}
