'use client'

import { useTransition } from 'react'
import { platformBanUser } from '@/app/actions/admin'

export default function BanButton({ userId, isBanned }: { userId: string; isBanned: boolean }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(() => platformBanUser(userId, !isBanned))
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50 ${
        isBanned
          ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          : 'bg-red-50 text-red-600 hover:bg-red-100'
      }`}
    >
      {pending ? '...' : isBanned ? 'Unban' : 'Ban'}
    </button>
  )
}
