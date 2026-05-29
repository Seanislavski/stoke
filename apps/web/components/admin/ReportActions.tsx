'use client'

import { useTransition } from 'react'
import { resolveReport, dismissReport } from '@/app/actions/reports'

export default function ReportActions({
  reportId,
  communitySlug,
}: {
  reportId: string
  communitySlug?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        disabled={pending}
        onClick={() => startTransition(() => void resolveReport(reportId, communitySlug))}
        className="text-xs px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 rounded-lg font-medium transition-colors"
      >
        Resolve
      </button>
      <button
        disabled={pending}
        onClick={() => startTransition(() => void dismissReport(reportId, communitySlug))}
        className="text-xs px-2.5 py-1 bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50 rounded-lg font-medium transition-colors"
      >
        Dismiss
      </button>
    </div>
  )
}
