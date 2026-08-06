// Normalization + validation for the Discord handle on a profile.
//
// Modern Discord usernames are lowercase and may contain letters, digits,
// underscores and periods (2–32 chars). Legacy names carried a #1234
// discriminator, which some long-time members still write out of habit — we
// accept and keep it rather than rejecting something they believe is correct.

const MODERN = /^[a-z0-9._]{2,32}$/
const LEGACY = /^[a-z0-9._]{2,32}#\d{4}$/

export type DiscordHandleResult = { value: string | null; error?: string }

/**
 * Returns the value to store, or an error to show the user.
 * An empty input is valid and clears the field.
 */
export function normalizeDiscordUsername(raw: string | null | undefined): DiscordHandleResult {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { value: null }

  // People paste "@name", a profile URL, or a name with stray spaces.
  let handle = trimmed.replace(/^@+/, '').trim().toLowerCase()
  const urlMatch = handle.match(/^(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.com\/users\/(\d+)$/)
  if (urlMatch) {
    return { value: null, error: 'That looks like a Discord user ID link. Enter your username instead.' }
  }
  handle = handle.replace(/\s+/g, '')

  if (handle.length > 37) {
    return { value: null, error: 'That is too long to be a Discord username.' }
  }
  if (!MODERN.test(handle) && !LEGACY.test(handle)) {
    return {
      value: null,
      error: 'Use only letters, numbers, periods and underscores — for example sean.baldwin',
    }
  }

  return { value: handle }
}
