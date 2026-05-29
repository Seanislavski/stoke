'use client'

import { useState, useTransition } from 'react'
import { submitReport } from '@/app/actions/reports'

const REASONS = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam', label: 'Spam' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
]

export default function ReportButton({
  reportedUserId,
  communityId,
}: {
  reportedUserId: string
  communityId?: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('harassment')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function handleOpen() {
    setOpen(true)
    setSubmitted(false)
    setError('')
    setReason('harassment')
    setDetails('')
  }

  function handleSubmit() {
    setError('')
    startTransition(async () => {
      const result = await submitReport(reportedUserId, reason, details, communityId)
      if (result.error) {
        setError(result.error)
      } else {
        setSubmitted(true)
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs text-stone-400 hover:text-red-500 transition-colors"
      >
        Report
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            {submitted ? (
              <>
                <h2 className="text-base font-semibold text-stone-900 mb-2">Report submitted</h2>
                <p className="text-sm text-stone-500 mb-4">
                  Thanks for letting us know. We'll review this report.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-stone-900 mb-1">Report user</h2>
                <p className="text-sm text-stone-500 mb-4">
                  {communityId ? 'This report will be sent to the community moderators.' : 'This report will be reviewed by platform staff.'}
                </p>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Reason</label>
                    <select
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="w-full text-sm text-stone-900 border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      {REASONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Details <span className="text-stone-400 font-normal">(optional)</span></label>
                    <textarea
                      value={details}
                      onChange={e => setDetails(e.target.value)}
                      placeholder="Describe what happened..."
                      rows={3}
                      maxLength={500}
                      className="w-full text-sm text-stone-900 border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    />
                  </div>
                </div>

                {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 px-4 py-2 border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={pending}
                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                  >
                    {pending ? 'Submitting...' : 'Submit report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
