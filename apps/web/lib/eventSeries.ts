// Recurring-event occurrence generation. NOT a 'use server' file — plain server
// helpers shared by the create action and the cron top-up. Occurrences are
// materialized as normal rows in `events`; a series is generated up to a rolling
// horizon and topped up over time so perpetual series stay filled.
import type { SupabaseClient } from '@supabase/supabase-js'
import { wallTimeToUtcIso } from './eventTime'

export const HORIZON_DAYS = 90

export type Frequency = 'weekly' | 'biweekly' | 'monthly'
export type EndType = 'count' | 'until' | 'never'

export type SeriesRow = {
  id: string
  community_id: string
  created_by: string
  title: string
  description: string | null
  location_type: string
  location_online: string | null
  location_address: string | null
  photos: string[] | null
  tz: string
  frequency: Frequency
  start_wall: string          // 'YYYY-MM-DDTHH:mm'
  duration_minutes: number | null
  end_type: EndType
  occurrence_count: number | null
  until_date: string | null   // 'YYYY-MM-DD'
  generated_count: number
}

// Advance a wall-clock 'YYYY-MM-DDTHH:mm' by `steps` periods, keeping the
// time-of-day identical. DST is handled later at UTC conversion, so "10:00"
// stays "10:00" in the series timezone across a clock change.
export function advanceWall(startWall: string, frequency: Frequency, steps: number): string {
  const [datePart, timePart] = startWall.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  let year: number, month: number, day: number

  if (frequency === 'monthly') {
    const total = (mo - 1) + steps
    year = y + Math.floor(total / 12)
    month = (total % 12) + 1
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate() // day 0 of next month
    day = Math.min(d, lastDay)                                       // clamp (e.g. 31 -> 30/28)
  } else {
    const perStepDays = frequency === 'biweekly' ? 14 : 7
    const base = new Date(Date.UTC(y, mo - 1, d))
    base.setUTCDate(base.getUTCDate() + perStepDays * steps)
    year = base.getUTCFullYear(); month = base.getUTCMonth() + 1; day = base.getUTCDate()
  }

  const p = (n: number) => String(n).padStart(2, '0')
  return `${year}-${p(month)}-${p(day)}T${timePart}`
}

// Generate any not-yet-created occurrences for a series up to the rolling
// horizon (bounded by its end condition), insert them, and update the series
// bookkeeping. Returns how many rows were created. Idempotent: resumes from
// generated_count, so calling it repeatedly only fills forward.
export async function generateForSeries(admin: SupabaseClient, series: SeriesRow): Promise<number> {
  const horizon = new Date(Date.now() + HORIZON_DAYS * 86400000)
  const rows: Record<string, unknown>[] = []
  let i = series.generated_count
  let done = false
  const MAX_PER_RUN = 400 // safety cap

  while (rows.length < MAX_PER_RUN) {
    if (series.end_type === 'count' && series.occurrence_count != null && i >= series.occurrence_count) {
      done = true
      break
    }
    const startWall = advanceWall(series.start_wall, series.frequency, i)
    if (series.end_type === 'until' && series.until_date && startWall.split('T')[0] > series.until_date) {
      done = true
      break
    }
    const startsAt = wallTimeToUtcIso(startWall, series.tz)
    if (new Date(startsAt) > horizon) break // horizon-limited (not done — cron tops up later)

    const endsAt = series.duration_minutes != null
      ? new Date(new Date(startsAt).getTime() + series.duration_minutes * 60000).toISOString()
      : null

    rows.push({
      community_id: series.community_id,
      created_by: series.created_by,
      title: series.title,
      description: series.description,
      starts_at: startsAt,
      ends_at: endsAt,
      location_type: series.location_type,
      location_online: series.location_online,
      location_address: series.location_address,
      photos: series.photos ?? [],
      series_id: series.id,
      recurrence: series.frequency,
    })
    i++
  }

  if (rows.length > 0) {
    await admin.from('events').insert(rows)
  }
  const update: Record<string, unknown> = { generated_count: i }
  if (done) update.active = false
  await admin.from('event_series').update(update).eq('id', series.id)

  return rows.length
}

// Cron entry point: top up every active series.
export async function topUpAllSeries(admin: SupabaseClient): Promise<number> {
  const { data: series } = await admin.from('event_series').select('*').eq('active', true)
  let total = 0
  for (const s of (series ?? []) as SeriesRow[]) {
    total += await generateForSeries(admin, s)
  }
  return total
}
