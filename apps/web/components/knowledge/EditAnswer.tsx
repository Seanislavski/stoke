'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { editAnswer } from '@/app/actions/knowledge'

type Props = {
  answerId: string
  communityId: string
  slug: string
  initialBody: string
  initialUrl: string | null
  willRequeue: boolean
  canEdit: boolean
  children: React.ReactNode
}

export default function EditAnswer({ answerId, communityId, slug, initialBody, initialUrl, willRequeue, canEdit, children }: Props) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()

  if (!canEdit) return <>{children}</>

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await editAnswer(answerId, communityId, slug, formData)
      if (res.error) { setError(res.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <div>
        {children}
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-stone-400 hover:text-orange-600 transition-colors"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 mt-1">
      <textarea
        name="body"
        rows={4}
        required
        maxLength={4000}
        defaultValue={initialBody}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
      />
      <input
        name="url"
        type="url"
        defaultValue={initialUrl ?? ''}
        placeholder="Add a link (optional)"
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />
      {willRequeue && (
        <p className="text-xs text-amber-600">
          Saving your edit sends this answer back for review — it’ll be hidden until an organizer re-approves it.
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError('') }}
          className="px-3 py-1.5 text-stone-500 hover:text-stone-800 text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
