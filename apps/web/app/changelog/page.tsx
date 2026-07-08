import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'
import { CHANGELOG } from '@/lib/changelog'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "What's new",
  description: 'The latest features and improvements on Stoke Community.',
  openGraph: {
    title: "What's new — Stoke Community",
    description: 'The latest features and improvements on Stoke Community.',
    url: 'https://stoke.community/changelog',
  },
}

function fmt(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function ChangelogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Nav */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href={user ? '/home' : '/'}>
            <StokeWordmark iconSize={28} />
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/home" className="text-sm text-stone-600 hover:text-stone-900 font-medium transition-colors">
                Home
              </Link>
            ) : (
              <>
                <Link href="/pricing" className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
                  Pricing
                </Link>
                <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
                  Sign in
                </Link>
                <Link href="/signup" className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-2xl mx-auto px-4 pt-16 pb-8 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-4 leading-tight">What&apos;s new</h1>
          <p className="text-lg text-stone-600 leading-relaxed">
            The latest features and improvements on Stoke.
          </p>
        </section>

        <section className="max-w-2xl mx-auto px-4 pb-20">
          <ol className="relative border-l border-stone-200 ml-3">
            {CHANGELOG.map(entry => (
              <li key={entry.date} className="mb-10 ml-6">
                <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-orange-400 border-2 border-stone-50" />
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">{fmt(entry.date)}</p>
                <h2 className="text-lg font-semibold text-stone-900 mt-1 mb-3">{entry.title}</h2>
                <ul className="space-y-2">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-stone-600 leading-relaxed">
                      <span className="text-orange-400 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
