'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { normalizeDiscordUsername } from '@/lib/discord-handle'

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
  const discordRaw = formData.get('discord_username') as string | null

  const discord = normalizeDiscordUsername(discordRaw)
  if (discord.error) return { error: discord.error }

  const update: Record<string, unknown> = {
    display_name,
    bio,
    show_memberships,
    discord_username: discord.value,
    // Clearing the handle also clears the opt-in, so a re-added handle is never
    // silently published on the strength of a checkbox ticked months earlier.
    show_discord: discord.value ? formData.get('show_discord') === 'on' : false,
  }
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

// Called after the Discord identity is unlinked in the browser. Clears the id
// and hides the handle, but deliberately leaves claimed captures alone —
// disconnecting a sign-in method is not the same as disowning what you wrote.
export async function clearDiscordLink() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ discord_user_id: null, show_discord: false })
    .eq('id', user.id)
  if (error) return { error: 'Could not disconnect Discord.' }

  revalidatePath('/settings/profile')
  revalidatePath('/profile')
  return { success: true }
}

// One-time username pick for members whose username was DERIVED for them (OAuth
// signups). Refuses once username_chosen is true, so this can never become a
// general rename — usernames stay stable, which is what the profile page
// promises everyone else.
export async function chooseUsername(username: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const candidate = username.trim()
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(candidate)) {
    return { error: 'Use 3–30 letters, numbers or underscores.' }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('username, username_chosen').eq('id', user.id).maybeSingle()
  if (!profile) return { error: 'Profile not found' }
  if (profile.username_chosen) return { error: 'Your username has already been set.' }

  // Case-insensitive check: "Sean" and "sean" must not both be takeable.
  const { data: taken } = await admin
    .from('profiles').select('id').ilike('username', candidate).neq('id', user.id).maybeSingle()
  if (taken) return { error: 'That username is taken.' }

  const { error } = await admin
    .from('profiles')
    .update({ username: candidate, username_chosen: true })
    .eq('id', user.id)
  if (error) return { error: 'That username is taken.' }

  revalidatePath('/settings/profile')
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
