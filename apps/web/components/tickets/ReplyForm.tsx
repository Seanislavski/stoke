'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addReply } from '@/app/actions/tickets'

export default function ReplyForm({ ticketId }: { ticketId: string }) {
  const [content, setContent] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    startTransition(async () => {
      await addReply(ticketId, content.trim())
      setContent('')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Write a reply..."
        className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
      />
      <button
        type="submit"
        disabled={pending || !content.trim()}
        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0"
      >
        {pending ? '…' : 'Send'}
      </button>
    </form>
  )
}
