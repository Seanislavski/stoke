import { getGuideAccess } from '@/lib/guide-access'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The library needs your eyes',
  description:
    'For Body Doubling moderators — how to search the Q&A library from Discord with /library, and how to capture the good answers that would otherwise scroll past.',
}

/**
 * The saved version of the mod-chat post from 07/30/2026. Discord threads
 * collapse and the post is unfindable a week later, which is the same problem
 * the post itself is about — so it lives here too.
 */
const POSTED_ON = '07/30/2026'

/** Terms `/library` came up empty on when the coverage check was run. */
const gaps = [
  'procrastination',
  'motivation',
  'medication',
  'sleep',
  'rewards',
  'burnout',
  'accountability',
  'hyperfocus',
  'planners',
  'anxiety',
  'exercise',
]

const toc = [
  { href: '#search', label: 'Searching from Discord' },
  { href: '#gaps', label: "What's missing" },
  { href: '#capture', label: 'Capturing a good answer' },
  { href: '#consent', label: 'How permission works' },
  { href: '#walkthrough', label: 'Full walkthrough' },
]

function Section({ id, title, eyebrow, children }: { id: string; title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      {eyebrow && <p className="text-xs uppercase tracking-widest text-orange-500 font-semibold mb-1.5">{eyebrow}</p>}
      <h2 className="text-2xl font-bold text-stone-900 mb-4">{title}</h2>
      <div className="space-y-4 text-stone-600 leading-relaxed">{children}</div>
    </section>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-4 border-orange-400 bg-stone-50 px-4 py-3 text-sm text-stone-700 leading-relaxed">
      {children}
    </div>
  )
}

function Cmd({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-stone-100 border border-stone-200 px-1.5 py-0.5 text-[0.9em] font-mono text-stone-800">
      {children}
    </code>
  )
}

export default async function DiscordLibraryGuidePage() {
  // Same staff gate as the organizer guide and the capture walkthrough.
  const { userId, isStaff } = await getGuideAccess()
  if (!userId) redirect('/login')
  if (!isStaff) redirect('/home')

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/home">
            <StokeWordmark iconSize={28} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/guide/capture" className="text-sm text-stone-600 hover:text-stone-900 font-medium transition-colors">
              Capture walkthrough
            </Link>
            <Link href="/guide" className="text-sm text-stone-600 hover:text-stone-900 font-medium transition-colors">
              Organizer guide
            </Link>
            <Link href="/home" className="text-sm text-stone-600 hover:text-stone-900 font-medium transition-colors">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-orange-500 to-orange-600">
          <div className="max-w-3xl mx-auto px-4 py-16">
            <p className="text-xs uppercase tracking-widest text-white/90 font-bold">Body Doubling · Moderator Guide</p>
            <h1 className="text-4xl font-bold text-white mt-3 leading-tight">
              📚 The library needs your eyes
            </h1>
            <p className="text-orange-50 leading-relaxed mt-4 max-w-2xl">
              Two things, and the second one&rsquo;s the ask. Silas can now search the Q&amp;A library from Discord — and
              the library is thin, which is the part that needs you.
            </p>
            <p className="inline-block mt-6 text-sm font-semibold text-white bg-white/20 rounded-full px-4 py-1.5">
              Posted in mod chat {POSTED_ON} · saved here so it doesn&rsquo;t scroll away
            </p>
          </div>
        </section>

        <div className="max-w-3xl mx-auto px-4 py-14 space-y-14">
          {/* TOC */}
          <nav className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-3">On this page</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {toc.map(item => (
                <li key={item.href}>
                  <a href={item.href} className="text-orange-600 hover:text-orange-700 hover:underline">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <Section id="search" eyebrow="First" title="Silas can search the library from Discord">
            <p>
              Try <Cmd>/library task</Cmd> or <Cmd>/library distractions</Cmd>. You get back the closest matching
              questions from the Q&amp;A library, with a link straight to each one.
            </p>
            <p>
              Only you see the result — unless you add <Cmd>share:true</Cmd> to post it in the channel.{' '}
              <strong className="text-stone-900">That&rsquo;s the real use case:</strong> someone asks a question
              that&rsquo;s been answered before, and you drop the answer right there.
            </p>
            <Note>
              The links work for people who aren&rsquo;t signed in, so sharing one isn&rsquo;t sending someone into a
              login wall.
            </Note>
          </Section>

          <Section id="gaps" eyebrow="Second — the ask" title="The library is thin">
            <p>
              A coverage check on {POSTED_ON}: of the 24 things tried — things a member might plausibly search
              for — the library could answer <strong className="text-stone-900">13</strong>.
            </p>
            <p>Here&rsquo;s what it came up empty on:</p>
            <ul className="flex flex-wrap gap-2 not-prose">
              {gaps.map(term => (
                <li
                  key={term}
                  className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900"
                >
                  {term}
                </li>
              ))}
            </ul>
            <p>
              Every one of those gets talked about in the server regularly.{' '}
              <strong className="text-stone-900">None of it is saved anywhere.</strong> It scrolls past and it&rsquo;s
              gone.
            </p>
            <Note>
              These numbers are a snapshot from {POSTED_ON}, not a live reading — they should improve as captures come
              in. Re-run the check rather than quoting them later.
            </Note>
          </Section>

          <Section id="capture" eyebrow="What to do about it" title="Capture the good answers">
            <p>
              When you see someone drop a genuinely good answer — the kind you&rsquo;d want to link to next time it
              comes up:
            </p>
            <div className="rounded-xl border-2 border-orange-300 bg-orange-50/60 px-5 py-4 text-center">
              <p className="text-lg font-semibold text-stone-900">
                Right-click the message → Apps → 📚 Capture for Stoke
              </p>
            </div>
            <p>
              <strong className="text-stone-900">Capture generously.</strong> It costs the author one button press, and
              a &ldquo;maybe&rdquo; they turn down is completely fine — better than a good answer nobody ever finds
              again.
            </p>
          </Section>

          <Section id="consent" title="You don't have to ask them anything">
            <p>
              Silas DMs the author himself and asks how they&rsquo;d like it handled —{' '}
              <strong className="text-stone-900">with credit, anonymously, or not at all.</strong>
            </p>
            <p>
              Nothing gets published unless they say yes. If they say no, that&rsquo;s the end of it, and they&rsquo;re
              never asked again.
            </p>
          </Section>

          <Section id="walkthrough" title="Full walkthrough">
            <p>
              The step-by-step version — with screenshots of every stage, what each error message means, and what
              happens after the author says yes — is in the capture guide.
            </p>
            <Link
              href="/guide/capture"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-white font-semibold hover:bg-orange-600 transition-colors"
            >
              Read the capture walkthrough →
            </Link>
          </Section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
