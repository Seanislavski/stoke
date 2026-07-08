// Timezone handling for events. Events are stored as UTC instants; input is
// interpreted in the creator's timezone and display is formatted in the
// viewer's timezone (both from profiles.timezone). The app runs on Railway in
// UTC, so we must never rely on the server's local zone — every conversion here
// is pinned to an explicit IANA timezone via Intl.

export const DEFAULT_TZ = 'America/New_York'

// Offset (ms) of a given instant in a named timezone: tzWallTime - utcTime.
// Negative west of UTC (e.g. -4h for ET in summer / EDT).
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const m: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) m[p.type] = p.value
  const hour = m.hour === '24' ? '00' : m.hour // Intl can emit "24" at midnight
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +hour, +m.minute, +m.second)
  return asUTC - date.getTime()
}

// Interpret a wall-clock "YYYY-MM-DDTHH:mm" (from <input datetime-local>) as
// happening in `tz` and return the UTC ISO string to store.
export function wallTimeToUtcIso(wall: string, tz: string = DEFAULT_TZ): string {
  const [datePart, timePart = '00:00'] = wall.split('T')
  const [y, mo, day] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const naiveUtc = Date.UTC(y, mo - 1, day, h, mi)   // pretend wall time is UTC
  const offset = tzOffsetMs(new Date(naiveUtc), tz)  // that zone's offset near it
  return new Date(naiveUtc - offset).toISOString()
}

// Display an instant (UTC ISO) in the given timezone.
export function formatEventDate(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
  })
}

export function formatEventTime(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: tz,
  })
}

// Short zone label for an instant in a zone, e.g. "EDT", "PST", "GMT+1".
export function tzAbbrev(iso: string, tz: string = DEFAULT_TZ): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, timeZoneName: 'short', hour: 'numeric',
  }).formatToParts(new Date(iso))
  return parts.find(p => p.type === 'timeZoneName')?.value ?? ''
}

// Curated list for the profile timezone picker. The user's actual (detected)
// zone is always shown even if it isn't in this list — the form adds it.
export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain Time — no DST (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
  { value: 'America/Halifax', label: 'Atlantic Time (Halifax)' },
  { value: 'America/Sao_Paulo', label: 'Brazil (São Paulo)' },
  { value: 'Europe/London', label: 'UK / Ireland (London)' },
  { value: 'Europe/Paris', label: 'Central Europe (Paris)' },
  { value: 'Europe/Athens', label: 'Eastern Europe (Athens)' },
  { value: 'Africa/Johannesburg', label: 'South Africa (Johannesburg)' },
  { value: 'Asia/Dubai', label: 'Gulf (Dubai)' },
  { value: 'Asia/Kolkata', label: 'India (Kolkata)' },
  { value: 'Asia/Singapore', label: 'Singapore / Malaysia' },
  { value: 'Asia/Tokyo', label: 'Japan (Tokyo)' },
  { value: 'Australia/Sydney', label: 'Eastern Australia (Sydney)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (Auckland)' },
  { value: 'UTC', label: 'UTC' },
]
