import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

export const metadata: Metadata = {
  title: 'Stoke Community — A place where everyone has something to offer',
  description: 'Build reciprocal communities where every member gives and receives — skills, time, knowledge, and support. No algorithms. No noise. Just people helping each other.',
  openGraph: {
    title: 'Stoke Community — A place where everyone has something to offer',
    description: 'Build reciprocal communities where every member gives and receives — skills, time, knowledge, and support.',
    url: 'https://stoke.community',
  },
}

const communityTypes = [
  { emoji: '🏘️', name: 'Neighborhood groups', description: 'Stay connected with the people who live around you.' },
  { emoji: '💼', name: 'Professional networks', description: 'Peers who share what they know and open doors for each other.' },
  { emoji: '🎨', name: 'Hobby clubs', description: 'Find your people around the things you love doing.' },
  { emoji: '🤝', name: 'Support communities', description: 'Show up for each other when it matters most.' },
  { emoji: '🎓', name: 'Alumni networks', description: 'Stay connected long after you\'ve moved on.' },
  { emoji: '🌱', name: 'Volunteer orgs', description: 'Coordinate, contribute, and make things happen together.' },
]

const steps = [
  {
    number: '1',
    title: 'Create your space',
    description: 'Set up your community in minutes. Choose who can join, how they apply, and what features to enable.',
  },
  {
    number: '2',
    title: 'Invite your people',
    description: 'Share a link or send invites directly. Members join with a single Stoke account — no new signup for every community.',
  },
  {
    number: '3',
    title: 'Give and receive',
    description: 'A bulletin board, events, channels, and resources give everyone a way to contribute and get value back.',
  },
]

const features = [
  { emoji: '📋', name: 'Bulletin board', description: 'Share announcements and discussions that the whole community can respond to.' },
  { emoji: '💬', name: 'Gathering spaces', description: 'Real-time text channels for ongoing conversation and coordination.' },
  { emoji: '📅', name: 'Events', description: 'Schedule meetups, workshops, or virtual hangouts and track RSVPs.' },
  { emoji: '📚', name: 'Resource library', description: 'Members share guides, links, and tools the whole community can use.' },
  { emoji: '👥', name: 'Member management', description: 'Roles, moderation controls, and flexible join settings built in.' },
  { emoji: '📧', name: 'Email updates', description: 'Reach your whole community with announcements straight to their inbox.' },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/home')

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Nav */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <StokeWordmark iconSize={28} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
              About
            </Link>
            <Link href="/pricing" className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 leading-tight max-w-3xl mx-auto">
          A place where everyone has something to offer
        </h1>
        <p className="mt-5 text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed">
          Stoke gives your community a real home — a space where members genuinely give and receive skills, time, knowledge, and support. No algorithms. No noise. Just people helping each other.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold text-base hover:bg-orange-600 transition-colors"
          >
            Start a community
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto bg-white border border-stone-300 text-stone-700 px-6 py-3 rounded-xl font-semibold text-base hover:bg-stone-50 transition-colors"
          >
            Join a community
          </Link>
        </div>
        <p className="mt-4 text-sm text-stone-500">
          Have an invite link? Just open it — we&apos;ll walk you through joining.
        </p>
      </section>

      {/* Two ways in */}
      <section className="max-w-5xl mx-auto px-4 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="text-2xl mb-3">🧭</div>
            <h3 className="font-semibold text-stone-900 text-base mb-1">Organizing a community?</h3>
            <p className="text-stone-500 text-sm leading-relaxed mb-4">
              Set up a real home for your people in minutes — bulletin board, events, channels, and more. Start free, no credit card.
            </p>
            <Link href="/signup" className="text-sm font-semibold text-orange-600 hover:underline">
              Start a community →
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="text-2xl mb-3">🤝</div>
            <h3 className="font-semibold text-stone-900 text-base mb-1">Here to join one?</h3>
            <p className="text-stone-500 text-sm leading-relaxed mb-4">
              One free account works everywhere on Stoke. Got an invite link? Open it and you&apos;re in. Otherwise, sign up and browse the communities that fit you.
            </p>
            <Link href="/signup" className="text-sm font-semibold text-orange-600 hover:underline">
              Create your free account →
            </Link>
          </div>
        </div>
      </section>

      {/* Community types */}
      <section className="bg-white border-y border-stone-200 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-stone-900 text-center mb-2">
            Every kind of community, one platform
          </h2>
          <p className="text-stone-500 text-center mb-10 text-base">
            Whether you&apos;re organizing twelve neighbors or twelve hundred professionals, Stoke fits.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {communityTypes.map(({ emoji, name, description }) => (
              <div key={name} className="flex items-start gap-4 p-4 rounded-xl hover:bg-stone-50 transition-colors">
                <span className="text-2xl shrink-0">{emoji}</span>
                <div>
                  <h3 className="font-semibold text-stone-900 text-sm">{name}</h3>
                  <p className="text-stone-500 text-sm mt-0.5 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-stone-900 text-center mb-2">How it works</h2>
        <p className="text-stone-500 text-center mb-12 text-base">Up and running in minutes.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map(({ number, title, description }) => (
            <div key={number} className="text-center">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold text-lg flex items-center justify-center mx-auto mb-4">
                {number}
              </div>
              <h3 className="font-semibold text-stone-900 text-base mb-2">{title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-stone-200 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-stone-900 text-center mb-2">Everything your community needs</h2>
          <p className="text-stone-500 text-center mb-10 text-base">
            Built-in tools that grow with you — no plugins, no third-party integrations required.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {features.map(({ emoji, name, description }) => (
              <div key={name} className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                <div className="text-2xl mb-3">{emoji}</div>
                <h3 className="font-semibold text-stone-900 text-sm mb-1">{name}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-orange-500 py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to bring your people together?</h2>
          <p className="text-orange-100 mb-6 text-base leading-relaxed">
            Start for free. No credit card required. Your community deserves a real home.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-orange-600 font-semibold px-6 py-3 rounded-xl hover:bg-orange-50 transition-colors"
          >
            Start a community — it&apos;s free
          </Link>
          <p className="mt-4 text-sm text-orange-100">
            Just here to join a community?{' '}
            <Link href="/signup" className="text-white font-semibold underline hover:text-orange-50">
              Create a free account
            </Link>
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
