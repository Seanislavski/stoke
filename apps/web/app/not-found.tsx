import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// The app had no not-found page at all, so every bad link landed on Next's
// built-in default — unstyled, no way back, and near-invisible against the
// stone background. This is where mistyped and stale links arrive, so it says
// what happened and offers a way onward.
export default async function NotFound() {
  // Links differ by who's asking: /communities and /home send a logged-out
  // visitor to the login wall, which is a second dead end.
  let signedIn = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    signedIn = !!user
  } catch {
    // An error page must never fail. Fall back to the public links.
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-5xl mb-4" aria-hidden="true">🔍</p>
        <h1 className="text-xl font-semibold text-stone-900">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          The link may be mistyped, or whatever was here has since been removed.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={signedIn ? '/home' : '/'}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {signedIn ? 'Go home' : 'Go to Stoke'}
          </Link>
          {signedIn && (
            <Link
              href="/communities"
              className="px-4 py-2 border border-stone-300 text-stone-700 text-sm font-medium rounded-lg hover:bg-stone-50 transition-colors"
            >
              Browse communities
            </Link>
          )}
        </div>

        {/* /support is gated, so this would be another dead end when logged out. */}
        {signedIn && (
          <p className="mt-8 text-xs text-stone-400">
            Think this page should exist?{' '}
            <Link href="/support" className="text-orange-600 hover:underline">
              Let us know
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
