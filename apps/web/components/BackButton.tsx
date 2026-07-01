'use client'

import { useRouter } from 'next/navigation'

export default function BackButton({ fallback = '/home' }: { fallback?: string }) {
  const router = useRouter()

  const handleBack = () => {
    // If we have in-app history, go back to exactly where the user came from.
    // Otherwise (deep link / fresh tab) fall back to a sensible default.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors mb-4"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  )
}
