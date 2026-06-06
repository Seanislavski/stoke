'use client'

import { useState } from 'react'
import { sendEmailBlast } from '@/app/actions/email-blast'

type Props = {
  communityId: string
  memberCount: number
  lastBlastAt: string | null
}

export default function EmailBlastForm({ communityId, memberCount, lastBlastAt }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const hoursUntilNext = lastBlastAt
    ? Math.max(0, 24 - (Date.now() - new Date(lastBlastAt).getTime()) / 3600000)
    : 0
  const onCooldown = hoursUntilNext > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    setLoading(true)
    setStatus(null)
    const result = await sendEmailBlast(communityId, subject.trim(), body.trim())
    setLoading(false)
    if (result.error) {
      setStatus({ type: 'error', message: result.error })
    } else {
      setStatus({ type: 'success', message: `Sent to ${result.sent} member${result.sent !== 1 ? 's' : ''}.` })
      setSubject('')
      setBody('')
    }
  }

  return (
    <div className="mt-10 pt-8 border-t border-stone-200">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-stone-900">Email members</h2>
        <p className="text-sm text-stone-500 mt-0.5">
          Send an email to all {memberCount} active member{memberCount !== 1 ? 's' : ''}. One email per day maximum.
        </p>
      </div>

      {onCooldown ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Next blast available in {Math.ceil(hoursUntilNext)} hour{Math.ceil(hoursUntilNext) !== 1 ? 's' : ''}.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={200}
            required
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white text-stone-900"
          />
          <textarea
            placeholder="Write your message…"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            required
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white text-stone-900 resize-y"
          />
          {status && (
            <p className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {status.message}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !subject.trim() || !body.trim()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending…' : `Send to ${memberCount} member${memberCount !== 1 ? 's' : ''}`}
          </button>
        </form>
      )}
    </div>
  )
}
