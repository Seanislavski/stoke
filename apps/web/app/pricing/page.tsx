import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, honest pricing for community builders. Start free, upgrade when your community is ready.',
  openGraph: {
    title: 'Pricing — Stoke Community',
    description: 'Simple, honest pricing for community builders. Start free, upgrade when your community is ready.',
    url: 'https://stoke.community/pricing',
  },
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  )
}

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-stone-50">
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

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-10 text-center">
        <h1 className="text-4xl font-bold text-stone-900">Simple, honest pricing</h1>
        <p className="mt-4 text-lg text-stone-600 max-w-xl mx-auto">
          Start for free and grow at your own pace. Upgrade when your community is ready.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Free */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col">
            <div>
              <h2 className="font-semibold text-stone-900 text-lg">Free</h2>
              <p className="mt-2 text-3xl font-bold text-stone-900">
                $0<span className="text-base font-normal text-stone-500">/mo</span>
              </p>
              <p className="mt-2 text-sm text-stone-500">Perfect for getting started.</p>
            </div>
            <ul className="mt-5 space-y-2.5 flex-1">
              {[
                '1 community',
                'Up to 50 members',
                '3 channels',
                'Bulletin board, events & resources',
                'Basic moderation tools',
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {user ? (
                <Link
                  href="/settings/billing"
                  className="block text-center w-full py-2.5 rounded-xl text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Manage billing
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="block text-center w-full py-2.5 rounded-xl text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Get started free
                </Link>
              )}
            </div>
          </div>

          {/* Starter */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col">
            <div>
              <h2 className="font-semibold text-stone-900 text-lg">Starter</h2>
              <p className="mt-2 text-3xl font-bold text-stone-900">
                $19<span className="text-base font-normal text-stone-500">/mo</span>
              </p>
              <p className="mt-2 text-sm text-stone-500">For growing communities.</p>
            </div>
            <ul className="mt-5 space-y-2.5 flex-1">
              {[
                '3 communities',
                'Up to 300 members each',
                '15 channels per community',
                'Email notifications to members',
                'Remove Stoke branding on invites',
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                href={user ? '/settings/billing' : '/signup'}
                className="block text-center w-full py-2.5 rounded-xl text-sm font-semibold bg-stone-900 text-white hover:bg-stone-700 transition-colors"
              >
                {user ? 'Upgrade to Starter' : 'Get started'}
              </Link>
            </div>
          </div>

          {/* Pro */}
          <div className="bg-orange-50 rounded-2xl border border-orange-300 p-6 flex flex-col relative">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-semibold bg-orange-500 text-white px-2 py-0.5 rounded-full">
                Most popular
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-stone-900 text-lg">Pro</h2>
              <p className="mt-2 text-3xl font-bold text-stone-900">
                $49<span className="text-base font-normal text-stone-500">/mo</span>
              </p>
              <p className="mt-2 text-sm text-stone-500">For serious community builders.</p>
            </div>
            <ul className="mt-5 space-y-2.5 flex-1">
              {[
                'Unlimited communities',
                'Unlimited members',
                'Unlimited channels',
                'Priority support',
                'Everything in Starter',
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                href={user ? '/settings/billing' : '/signup'}
                className="block text-center w-full py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                {user ? 'Upgrade to Pro' : 'Get started'}
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="bg-orange-500 py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Questions? We&apos;re here.</h2>
          <p className="text-orange-100 mb-6 text-base">
            Every plan includes access to our support team.
          </p>
          <Link
            href={user ? '/support' : '/signup'}
            className="inline-block bg-white text-orange-600 font-semibold px-6 py-3 rounded-xl hover:bg-orange-50 transition-colors"
          >
            {user ? 'Contact support' : 'Start for free'}
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
