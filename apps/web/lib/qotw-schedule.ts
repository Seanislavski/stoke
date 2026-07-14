// Shared scheduling math for the Question of the Week auto-publisher, used by BOTH the
// cron route (to decide when to publish) and the manager UI (to show the live countdown)
// so the displayed "next switch" can never disagree with what actually happens.
//
// The daily cron (cron-job.org, America/New_York) hits /api/cron/qotw-publish once a day
// at QOTW_CRON_HOUR_ET. On each run, per community it publishes at most one draft:
//   1. Date wins — a draft whose planned_for date has arrived.
//   2. Else rotate — the next undated draft, once the weekly gap has elapsed.
//
// The rotate gate is compared at DATE granularity (not to-the-millisecond) so a daily
// cron reliably catches it on the eligible day instead of missing by minutes.

import { wallTimeToUtcIso, DEFAULT_TZ } from './eventTime'

export const ROTATE_GAP_MS = 7 * 24 * 60 * 60 * 1000
export const QOTW_CRON_HOUR_ET = 9 // the daily cron fires ~9:00 AM America/New_York
const ET = DEFAULT_TZ // 'America/New_York'

/** YYYY-MM-DD (UTC) for an instant. */
export function utcDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Add whole days to a YYYY-MM-DD string (UTC-safe). */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** The UTC instant of the daily cron run (9am ET) on a given calendar date. */
function cronRunAt(dateStr: string): Date {
  // At 9am ET the ET wall-date and the UTC date coincide (9am ET = 13:00/14:00 UTC),
  // so `dateStr` doubles as both the ET wall date and the UTC date to compare against.
  return new Date(wallTimeToUtcIso(`${dateStr}T${String(QOTW_CRON_HOUR_ET).padStart(2, '0')}:00`, ET))
}

/**
 * The date the weekly rotate gate opens for a community, given its last QotW's
 * published_at. Date-granularity: date(last + 7d). Null last → gate already open (today).
 */
export function rotateEligibleDate(lastPublishedAtISO: string | null, now = new Date()): string {
  if (!lastPublishedAtISO) return utcDateStr(now)
  return utcDateStr(new Date(new Date(lastPublishedAtISO).getTime() + ROTATE_GAP_MS))
}

/** Does the cron's rotate gate consider itself open on `now`'s run? (date >= eligible) */
export function isRotateGateOpen(lastPublishedAtISO: string | null, now = new Date()): boolean {
  return utcDateStr(now) >= rotateEligibleDate(lastPublishedAtISO, now)
}

/**
 * The first future daily-cron instant that will actually publish, given the earliest
 * calendar date the publish is permitted (eligible date). Walks day-by-day from today so
 * a 9am run that has already passed today rolls to tomorrow.
 */
export function nextCronSwitch(eligibleDateStr: string, now = new Date()): Date {
  let date = utcDateStr(now)
  if (eligibleDateStr > date) date = eligibleDateStr
  for (let i = 0; i < 400; i++) {
    const at = cronRunAt(date)
    if (at.getTime() > now.getTime() && utcDateStr(at) >= eligibleDateStr) return at
    date = addDays(date, 1)
  }
  return cronRunAt(date) // unreachable in practice
}

/**
 * Resolve what a community's NEXT auto-publish will be and exactly when it fires.
 * Returns null when there are no drafts to publish.
 *
 *  - rotate: the next undated draft, at the first 9am-ET run on/after date(last + 7d)
 *  - date:   the earliest dated draft, at the first 9am-ET run on/after its planned_for
 * Whichever comes first wins (mirrors the cron's per-run "date wins, else rotate").
 */
export function resolveNextPublish(
  opts: {
    lastPublishedAtISO: string | null
    undatedNext: { id: string; title: string } | null
    datedNext: { id: string; title: string; planned_for: string } | null
    now?: Date
  }
): { id: string; title: string; at: string; reason: 'date' | 'rotate'; gateOpen: boolean } | null {
  const now = opts.now ?? new Date()

  const candidates: { id: string; title: string; at: Date; reason: 'date' | 'rotate'; gateOpen: boolean }[] = []

  if (opts.datedNext) {
    const at = nextCronSwitch(opts.datedNext.planned_for, now)
    candidates.push({
      id: opts.datedNext.id, title: opts.datedNext.title, at,
      reason: 'date', gateOpen: utcDateStr(now) >= opts.datedNext.planned_for,
    })
  }
  if (opts.undatedNext) {
    const eligible = rotateEligibleDate(opts.lastPublishedAtISO, now)
    const at = nextCronSwitch(eligible, now)
    candidates.push({
      id: opts.undatedNext.id, title: opts.undatedNext.title, at,
      reason: 'rotate', gateOpen: isRotateGateOpen(opts.lastPublishedAtISO, now),
    })
  }
  if (candidates.length === 0) return null

  candidates.sort((a, b) => a.at.getTime() - b.at.getTime())
  const win = candidates[0]
  return { id: win.id, title: win.title, at: win.at.toISOString(), reason: win.reason, gateOpen: win.gateOpen }
}
