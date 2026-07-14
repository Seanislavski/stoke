'use client'

import { useEffect, useState } from 'react'

export type NextPublish = {
  id: string
  title: string
  at: string          // ISO — the exact instant the cron will publish
  reason: 'date' | 'rotate'
  gateOpen: boolean    // the cron would publish on its very next run
}

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }
}

/**
 * Live countdown to the next Question of the Week auto-publish. The `at` instant and
 * `gateOpen` flag are computed server-side from the SAME schedule math the cron uses
 * (lib/qotw-schedule.ts), so what this shows is exactly when the switch will happen.
 */
export default function NextPublishPanel({ next }: { next: NextPublish | null }) {
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!next) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="text-sm text-stone-500">
          Nothing queued to auto-publish. Add a draft below and it&apos;ll join the weekly rotation.
        </p>
      </div>
    )
  }

  const target = new Date(next.at).getTime()
  const remaining = target - now
  const p = parts(remaining)
  const overdue = remaining <= 0

  const whenLabel = new Date(next.at).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  })

  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
            ⭐ Next auto-publish
          </p>
          <p className="text-sm font-medium text-stone-900 mt-1 truncate">{next.title}</p>
          <p className="text-xs text-stone-500 mt-0.5">
            {next.reason === 'date'
              ? 'Scheduled by date'
              : 'Weekly rotation (next undated draft)'}
            {' · '}
            {whenLabel}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {overdue ? (
            <span className="inline-block text-sm font-semibold text-orange-700 bg-orange-100 rounded-lg px-3 py-1.5">
              Publishing on next cron run…
            </span>
          ) : (
            <div className="flex items-end gap-1.5 tabular-nums">
              {p.d > 0 && <TimeCell value={p.d} unit="d" />}
              <TimeCell value={p.h} unit="h" />
              <TimeCell value={p.m} unit="m" />
              <TimeCell value={p.s} unit="s" />
            </div>
          )}
        </div>
      </div>

      {next.gateOpen && !overdue && (
        <p className="text-xs text-stone-500 mt-3 pt-3 border-t border-orange-100">
          ⏳ This question is already eligible — it publishes at the next daily 9:00 AM ET run
          ({whenLabel}). Want it live sooner? Use <strong>Publish as QotW</strong> on it below.
        </p>
      )}
    </div>
  )
}

function TimeCell({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold text-orange-700 leading-none">{String(value).padStart(2, '0')}</span>
      <span className="text-[10px] text-orange-600/70 uppercase mt-0.5">{unit}</span>
    </div>
  )
}
