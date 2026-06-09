import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About',
  description: 'What if the whole community could win? Here, everybody wins by design. Learn about the mission behind Stoke Community.',
  openGraph: {
    title: 'About — Stoke Community',
    description: 'What if the whole community could win? Here, everybody wins by design.',
    url: 'https://stoke.community/about',
  },
}

const beliefs = [
  {
    title: 'Every member has something to offer.',
    body: 'The best communities don\'t have spectators. When everyone contributes — even a little — the whole group gets stronger.',
  },
  {
    title: 'The best communities are built on trust, not traffic.',
    body: 'We\'re not optimizing for engagement metrics or time-on-site. We\'re building tools that help people actually show up for each other.',
  },
  {
    title: 'Organizers deserve real tools.',
    body: 'Running a community is real work. Stoke gives organizers the infrastructure to do it well — without duct-taping together a dozen different apps.',
  },
  {
    title: 'Winning isn\'t zero-sum.',
    body: 'On most platforms, visibility is a competition. On Stoke, one member\'s success doesn\'t come at another\'s expense. When the community wins, everyone wins.',
  },
]

export default async function AboutPage() {
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

        {/* Mission */}
        <section className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
          <h1 className="text-4xl font-bold text-stone-900 mb-5 leading-tight">
            What if the whole community could win?<br />
            <span className="text-orange-500">Here, everybody wins by design.</span>
          </h1>
          <p className="text-lg text-stone-600 leading-relaxed max-w-2xl mx-auto">
            Most online platforms are built around competition — for attention, for followers, for reach. Stoke is built around something different: reciprocal community. A place where every member is both a giver and a receiver, and the community gets stronger because of it.
          </p>
        </section>

        {/* What makes Stoke different */}
        <section className="bg-white border-y border-stone-200 py-14">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-stone-900 text-center mb-10">Ways Stoke is different</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-stone-200 p-6">
                <h3 className="font-semibold text-stone-400 text-xs uppercase tracking-widest mb-3">Most platforms</h3>
                <ul className="space-y-2.5 text-stone-600 text-sm leading-relaxed">
                  <li className="flex items-start gap-2"><span className="text-stone-300 mt-0.5">✕</span> Built around broadcasting — a few voices, many listeners</li>
                  <li className="flex items-start gap-2"><span className="text-stone-300 mt-0.5">✕</span> Algorithms decide who gets seen</li>
                  <li className="flex items-start gap-2"><span className="text-stone-300 mt-0.5">✕</span> Engagement metrics over genuine connection</li>
                  <li className="flex items-start gap-2"><span className="text-stone-300 mt-0.5">✕</span> Members consume; organizers do all the work</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
                <h3 className="font-semibold text-orange-500 text-xs uppercase tracking-widest mb-3">Stoke</h3>
                <ul className="space-y-2.5 text-stone-700 text-sm leading-relaxed">
                  <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">✓</span> Built around exchange — every member gives and receives</li>
                  <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">✓</span> No algorithm — your community, your rules</li>
                  <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">✓</span> Tools built for real human relationships</li>
                  <li className="flex items-start gap-2"><span className="text-orange-400 mt-0.5">✓</span> Members contribute; everyone benefits</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* What we believe */}
        <section className="max-w-4xl mx-auto px-4 py-14">
          <h2 className="text-2xl font-bold text-stone-900 text-center mb-10">What we believe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {beliefs.map(({ title, body }) => (
              <div key={title} className="bg-white rounded-2xl border border-stone-200 p-6">
                <h3 className="font-semibold text-stone-900 mb-2 leading-snug">{title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works in practice */}
        <section className="bg-white border-y border-stone-200 py-14">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-stone-900 mb-4">What reciprocal community looks like in practice</h2>
            <p className="text-stone-500 text-base leading-relaxed mb-8">
              A neighbor shares a recommendation on the bulletin board. A professional posts a resource in the library. A hobbyist organizes an event. A member going through a hard time gets support from people who genuinely care. None of it requires a following or an algorithm — just people showing up for each other.
            </p>
            <p className="text-stone-500 text-base leading-relaxed">
              Stoke gives communities the tools to make that happen: a bulletin board for sharing, a resource library for knowledge, events for showing up in person, and channels for the ongoing conversation in between.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-orange-500 py-16">
          <div className="max-w-xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Start building something reciprocal.</h2>
            <p className="text-orange-100 mb-6 text-base">
              Free to start. No credit card required.
            </p>
            <Link
              href="/signup"
              className="inline-block bg-white text-orange-600 font-semibold px-6 py-3 rounded-xl hover:bg-orange-50 transition-colors"
            >
              Create a free account
            </Link>
          </div>
        </section>

      </main>

      <MarketingFooter />
    </div>
  )
}
