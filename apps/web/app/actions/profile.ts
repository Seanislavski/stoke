'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Basic sanity check that a string is a real IANA zone the runtime knows.
function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const display_name = formData.get('display_name') as string
  const bio = formData.get('bio') as string
  const show_memberships = formData.get('show_memberships') === 'on'
  const timezoneRaw = formData.get('timezone') as string | null

  const update: Record<string, unknown> = { display_name, bio, show_memberships }
  // Setting a timezone explicitly counts as detected so auto-detection stops.
  if (timezoneRaw && isValidTimeZone(timezoneRaw)) {
    update.timezone = timezoneRaw
    update.timezone_detected = true
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/profile')
  revalidatePath(`/profile`)
  return { success: true }
}

// Called once by the client on first visit to seed the profile timezone from
// the browser. Only writes while timezone_detected is false, so it never
// clobbers a zone the user has chosen manually.
export async function setDetectedTimezone(tz: string) {
  if (!tz || !isValidTimeZone(tz)) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles').select('timezone_detected').eq('id', user.id).maybeSingle()
  if (!profile || profile.timezone_detected) return

  await supabase
    .from('profiles')
    .update({ timezone: tz, timezone_detected: true })
    .eq('id', user.id)
}
