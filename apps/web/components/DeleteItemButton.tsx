'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteItemButton({
  action,
  confirm: confirmMsg = 'Are you sure you want to delete this?',
  label = 'Delete',
  className,
  redirectTo,
}: {
  action: () => Promise<{ error?: string }>
  confirm?: string
  label?: string
  className?: string
  // When the deleted item IS the current page (e.g. a question on its own detail
  // page), refreshing in place would 404 — navigate away instead.
  redirectTo?: string
}) {
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    if (!window.confirm(confirmMsg)) return
    setError('')
    startTransition(async () => {
      const result = await action()
      if (result.error) {
        setError(result.error)
      } else if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <span>
      <button
        onClick={handleClick}
        disabled={pending}
        className={className ?? 'text-xs text-stone-400 hover:text-red-600 disabled:opacity-50 transition-colors'}
      >
        {pending ? '…' : label}
      </button>
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </span>
  )
}
