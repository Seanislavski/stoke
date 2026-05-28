'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteItemButton({
  action,
  confirm: confirmMsg = 'Are you sure you want to delete this?',
  label = 'Delete',
  className,
}: {
  action: () => Promise<{ error?: string }>
  confirm?: string
  label?: string
  className?: string
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
