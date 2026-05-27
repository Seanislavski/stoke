'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function BannedPage() {
  useEffect(() => {
    createClient().auth.signOut()
  }, [])

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <div className="text-4xl mb-4">🚫</div>
        <h1 className="text-xl font-semibold text-stone-900 mb-2">Account suspended</h1>
        <p className="text-stone-500 text-sm mb-6">
          Your account has been suspended from Stoke Community. If you believe this is a mistake,
          please contact support.
        </p>
        <a
          href="/login"
          className="text-sm text-orange-600 hover:underline"
        >
          ← Back to login
        </a>
      </div>
    </div>
  )
}
