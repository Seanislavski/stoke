'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTicketStatus } from '@/app/actions/tickets'

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export default function StatusSelect({ ticketId, currentStatus }: { ticketId: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value
    startTransition(async () => {
      await updateTicketStatus(ticketId, status)
      router.refresh()
    })
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={pending}
      className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white text-stone-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-300"
    >
      {STATUSES.map(s => (
        <option key={s.value} value={s.value}>{s.label}</option>
      ))}
    </select>
  )
}
