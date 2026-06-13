import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Organizer Guide',
  description: 'How to run a thriving community on Stoke — a quick-start path plus a complete reference for organizers covering roles, the bulletin board, channels, events, the Q&A knowledge base, invites, moderation, and more.',
  openGraph: {
    title: 'Organizer Guide — Stoke Community',
    description: 'How to run a thriving community on Stoke — quick-start plus a complete organizer reference.',
    url: 'https://stoke.community/guide',
  },
}

const quickStart = [
  {
    title: 'Create your community',
    body: 'Go to Discover → Create a community. Choose a name, description, category, and a join mode (Request to join is a safe default). You automatically become the owner and first organizer.',
  },
  {
    title: 'Write a welcome post',
    body: 'On the Bulletin tab, post a short, warm welcome. It\'s the first thing new members see — tell them what the community is for and what to do first.',
  },
  {
    title: 'Create a channel',
    body: 'In Settings → Gathering Spaces, add your first channel (like #general or #introductions). Channels are real-time chat — the ongoing conversation that keeps a community feeling alive.',
  },
  {
    title: 'Invite your first members',
    body: 'In Settings → Invite links, generate a link and share it. It works even for people without a Stoke account — they\'ll be guided through signup.',
  },
  {
    title: 'Schedule an event',
    body: 'On the Events tab, create something to show up to — a kickoff call or recurring meetup. Events give members a concrete reason to return. (Optional, but powerful.)',
  },
]

const roles = [
  { role: 'Owner', what: 'The person who created the community', powers: 'Everything an organizer can do, plus the exclusive power to appoint Organizers.' },
  { role: 'Organizer', what: 'A community leader / co-owner-equivalent', powers: 'Full moderation, change member roles (appoint Moderators), and email the whole community.' },
  { role: 'Moderator', what: 'A trusted enforcer', powers: 'Full day-to-day moderation, but cannot change roles or email all members.' },
  { role: 'Member', what: 'A standard participant', powers: 'Post, RSVP, ask & answer questions, and chat.' },
]

const principles = [
  { title: 'Go first.', body: 'Post the welcome. Ask the first question. Answer a few. Communities take their cues from their organizer.' },
  { title: 'Delegate early.', body: 'Promote trusted members to Moderator before you\'re overwhelmed. Shared moderation is sustainable moderation.' },
  { title: 'Reward contribution, not consumption.', body: 'Celebrate the member who answered a question or organized a meetup. That behavior compounds.' },
  { title: 'Keep the bar honest.', body: 'Approve generously, but protect the signal. Every post and answer that appears is an implicit endorsement.' },
  { title: 'Let it breathe.', body: 'Don\'t over-build channels and categories before there\'s a reason. Structure should follow life, not precede it.' },
]

const toc = [
  { href: '#roles', label: 'Roles' },
  { href: '#join-modes', label: 'Join modes' },
  { href: '#bulletin', label: 'Bulletin board' },
  { href: '#channels', label: 'Channels' },
  { href: '#events', label: 'Events' },
  { href: '#qa', label: 'Q&A Knowledge Base' },
  { href: '#members', label: 'Members & moderation' },
  { href: '#invites', label: 'Invites' },
  { href: '#email', label: 'Emailing members' },
  { href: '#plans', label: 'Plans & limits' },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-2xl font-bold text-stone-900 mb-4">{title}</h2>
      <div className="space-y-4 text-stone-600 leading-relaxed">{children}</div>
    </section>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-stone-700 leading-relaxed">
      <span className="font-semibold text-orange-600">Tip: </span>{children}
    </div>
  )
}

export default async function GuidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Guide is for community staff (organizers/moderators/owners) and platform staff only
  const admin = createAdminClient()
  const [{ count: staffCount }, { data: platformRoleRow }] = await Promise.all([
    admin
      .from('community_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('role', ['organizer', 'moderator'])
      .eq('status', 'active'),
    supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ])
  const isStaff = (staffCount ?? 0) > 0 || !!platformRoleRow
  if (!isStaff) redirect('/home')

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
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-4 pt-16 pb-10 text-center">
          <p className="text-xs uppercase tracking-widest text-orange-500 font-semibold mb-3">Organizer Guide</p>
          <h1 className="text-4xl font-bold text-stone-900 mb-5 leading-tight">
            Running a community on Stoke
          </h1>
          <p className="text-lg text-stone-600 leading-relaxed max-w-2xl mx-auto">
            Everything you need to take your community from empty to thriving. Start with the 15-minute quick start, then dig into the full reference whenever you need it.
          </p>
        </section>

        {/* Quick start */}
        <section className="bg-white border-y border-stone-200 py-14">
          <div className="max-w-3xl mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-stone-900 mb-2">Quick start — your first 15 minutes</h2>
              <p className="text-stone-500">You don’t need to do everything at once. These five steps get your community live and ready for people.</p>
            </div>
            <ol className="space-y-5">
              {quickStart.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-stone-900">{step.title}</h3>
                    <p className="text-stone-600 text-sm leading-relaxed mt-0.5">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <Tip>
                A built-in onboarding checklist on your community page tracks these steps and disappears once you’ve done them all.
              </Tip>
            </div>
          </div>
        </section>

        {/* Full guide */}
        <section className="max-w-3xl mx-auto px-4 py-14">
          <h2 className="text-3xl font-bold text-stone-900 text-center mb-3">The full guide</h2>
          <p className="text-stone-500 text-center mb-8">A complete reference for every feature.</p>

          {/* Table of contents */}
          <nav className="rounded-2xl border border-stone-200 bg-white p-5 mb-12">
            <p className="text-xs uppercase tracking-widest text-stone-400 font-semibold mb-3">On this page</p>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              {toc.map(item => (
                <li key={item.href}>
                  <a href={item.href} className="text-orange-600 hover:text-orange-700 hover:underline">{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-14">
            {/* Roles */}
            <Section id="roles" title="Roles: who can do what">
              <p>Stoke has two layers of roles. As an organizer you only deal with the <strong>community</strong> layer.</p>
              <div className="overflow-hidden rounded-xl border border-stone-200">
                <table className="w-full text-sm">
                  <thead className="bg-stone-100 text-stone-500 text-left">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Role</th>
                      <th className="px-4 py-2 font-semibold">Key powers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {roles.map(r => (
                      <tr key={r.role}>
                        <td className="px-4 py-3 align-top">
                          <span className="font-semibold text-stone-800">{r.role}</span>
                          <span className="block text-xs text-stone-400 mt-0.5">{r.what}</span>
                        </td>
                        <td className="px-4 py-3 text-stone-600">{r.powers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p><strong>Organizers and Moderators share</strong> all everyday moderation: approving/rejecting/deleting bulletin posts, approving join requests, banning and removing members, creating events and channels and invite links, approving Q&amp;A content, and deleting inappropriate messages.</p>
              <p><strong>Only Organizers</strong> can change member roles (appoint Moderators) and email the whole community. <strong>Only the Owner</strong> can appoint Organizers — so organizers can build a moderation team, but can’t create new co-owners.</p>
              <Tip>
                To delegate moderation, go to <strong>Settings → Members</strong>, find the member, and switch their role to <strong>Moderator</strong>. Their powers apply only within your community — community roles never cross between communities.
              </Tip>
            </Section>

            {/* Join modes */}
            <Section id="join-modes" title="Join modes">
              <p>You choose how people get in when you create the community, and you can change it later in Settings → General:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong>Open</strong> — anyone joins instantly. Best for low-friction, public communities.</li>
                <li><strong>Request to join</strong> — people request and a mod approves. A light gate without being exclusive. <em>(Recommended default.)</em></li>
                <li><strong>Invite-only</strong> — people join only via an invite link, and even then they land in the approval queue. Best for private or curated groups.</li>
              </ul>
              <p className="text-sm text-stone-500">Invite links always route people through the approval queue for request and invite-only communities — an invite is a door, not an automatic membership.</p>
            </Section>

            {/* Bulletin */}
            <Section id="bulletin" title="The Bulletin board">
              <p>The bulletin is your community’s front page — announcements, shares, recommendations, questions to the group.</p>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong>Member posts require approval</strong> before they’re visible; you approve or reject pending posts.</li>
                <li><strong>Organizer and moderator posts publish immediately.</strong></li>
                <li>Posts support <strong>photos</strong> — single images or galleries — that open in a lightbox.</li>
              </ul>
              <Tip>Set the tone early with your welcome post. Approve generously, but keep spam and off-topic content out — the bar is &ldquo;does this serve the community?&rdquo;</Tip>
            </Section>

            {/* Channels */}
            <Section id="channels" title="Gathering Spaces (channels)">
              <p>Channels are real-time text chat — the day-to-day conversation. Create and manage them in <strong>Settings → Gathering Spaces</strong>.</p>
              <ul className="space-y-2 list-disc pl-5">
                <li>Messages appear in real time; consecutive messages from the same person are grouped for readability.</li>
                <li>Members can share links (which preview automatically) and images.</li>
                <li>Moderators and organizers can delete messages that don’t belong.</li>
              </ul>
              <Tip>Start with one or two channels. Don’t over-structure early — too many empty channels make a community feel dead.</Tip>
            </Section>

            {/* Events */}
            <Section id="events" title="Events">
              <p>Events give members a reason to show up — calls, meetups, sessions. <strong>Only organizers and moderators can create them.</strong></p>
              <ul className="space-y-2 list-disc pl-5">
                <li>Each event has a title, description, start/end time, and a location type: <strong>online</strong>, <strong>in person</strong>, or <strong>hybrid</strong>.</li>
                <li>Members RSVP <strong>Going</strong>, <strong>Maybe</strong>, or <strong>Can’t go</strong> — clicking the active status again clears it.</li>
                <li>Past events collapse into their own section so the tab stays focused on what’s coming up.</li>
                <li>Members who RSVP get an <strong>email reminder</strong> before the event starts.</li>
              </ul>
              <Tip>Recurring events are the heartbeat of many communities. Even a weekly check-in gives people rhythm and a reason to return.</Tip>
            </Section>

            {/* Q&A */}
            <Section id="qa" title="Q&A Knowledge Base">
              <p>The Q&amp;A tab is your community’s durable, searchable memory. In chat, good answers scroll away and get lost. Here, they last.</p>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong>Any member can ask, and any member can answer</strong> — but both questions and answers require moderator approval before they appear, keeping the knowledge base high-signal.</li>
                <li>When you approve a question, you <strong>file it into a category</strong> in the same step. You define categories in Settings → Q&amp;A categories.</li>
                <li>The asker or a moderator can mark <strong>one accepted answer</strong> per question. No upvotes or karma, on purpose — the goal is genuine help, not points.</li>
                <li>Every question has its own durable, shareable link.</li>
              </ul>
              <Tip>Seed it with the questions your community already asks over and over. Ten solid entries on day one makes the value obvious.</Tip>
            </Section>

            {/* Members */}
            <Section id="members" title="Members & moderation">
              <p>Manage everyone in <strong>Settings → Members</strong>, grouped into Pending requests, active Members, and Banned.</p>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong>Approve / reject</strong> join requests.</li>
                <li><strong>Change roles</strong> — promote to Moderator (the owner can also promote to Organizer).</li>
                <li><strong>Ban</strong> keeps someone out of this community; <strong>Remove</strong> takes them out without a ban; <strong>Unban</strong> restores them as a regular member.</li>
              </ul>
              <p>Every moderation action is recorded in the <strong>Audit log</strong> at the bottom of Settings, so your whole team can see what happened and when.</p>
              <Tip>Build a small moderation team before you need one. Promote one or two trusted, active members to Moderator early.</Tip>
            </Section>

            {/* Invites */}
            <Section id="invites" title="Invites — bringing people in">
              <p>Generate invite links in <strong>Settings → Invite links</strong>.</p>
              <ul className="space-y-2 list-disc pl-5">
                <li>Set an optional <strong>max number of uses</strong> and an optional <strong>expiry</strong> — or leave both open for an evergreen link.</li>
                <li><strong>Copy</strong> to share anywhere; <strong>revoke</strong> any time to shut it off.</li>
                <li>Links work for people <strong>without a Stoke account</strong> — they’re prompted to sign in or sign up, then land back on your community.</li>
              </ul>
              <Tip>Use a short-lived, limited-use link for one-off recruitment pushes, and a separate evergreen link for your website or Discord.</Tip>
            </Section>

            {/* Email */}
            <Section id="email" title="Emailing your members">
              <p>Organizers can send a community-wide email blast from <strong>Settings → Email members</strong>.</p>
              <ul className="space-y-2 list-disc pl-5">
                <li>Only <strong>organizers</strong> (and the owner) can send blasts — moderators cannot.</li>
                <li>A rate limit protects your members’ inboxes, so use it for things that matter.</li>
                <li>Stoke never exposes members’ email addresses to you — outreach is proxied.</li>
              </ul>
              <Tip>Email is your highest-attention channel and the easiest to overuse. Reserve it for moments that genuinely deserve everyone’s attention.</Tip>
            </Section>

            {/* Plans */}
            <Section id="plans" title="Plans & limits">
              <p>Every organizer starts on the <strong>Free</strong> plan and can upgrade any time in Settings → Billing.</p>
              <div className="overflow-hidden rounded-xl border border-stone-200">
                <table className="w-full text-sm">
                  <thead className="bg-stone-100 text-stone-500 text-left">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Plan</th>
                      <th className="px-4 py-2 font-semibold">Price</th>
                      <th className="px-4 py-2 font-semibold">Communities</th>
                      <th className="px-4 py-2 font-semibold">Members</th>
                      <th className="px-4 py-2 font-semibold">Channels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white text-stone-600">
                    <tr><td className="px-4 py-3 font-semibold text-stone-800">Free</td><td className="px-4 py-3">$0</td><td className="px-4 py-3">1</td><td className="px-4 py-3">up to 50</td><td className="px-4 py-3">up to 3</td></tr>
                    <tr><td className="px-4 py-3 font-semibold text-stone-800">Starter</td><td className="px-4 py-3">$19/mo</td><td className="px-4 py-3">3</td><td className="px-4 py-3">up to 300</td><td className="px-4 py-3">up to 15</td></tr>
                    <tr><td className="px-4 py-3 font-semibold text-stone-800">Pro</td><td className="px-4 py-3">$49/mo</td><td className="px-4 py-3">unlimited</td><td className="px-4 py-3">unlimited</td><td className="px-4 py-3">unlimited</td></tr>
                  </tbody>
                </table>
              </div>
              <p>When you hit a limit, Stoke shows an <strong>Upgrade</strong> prompt that links straight to billing. Nothing breaks — you’re just asked to upgrade to grow further.</p>
            </Section>
          </div>
        </section>

        {/* Philosophy */}
        <section className="bg-white border-y border-stone-200 py-14">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-stone-900 text-center mb-3">A short philosophy of running a good community</h2>
            <p className="text-stone-500 text-center mb-10 max-w-2xl mx-auto">Tools don’t make a community — people do. But the right tools, used well, make it dramatically easier for people to show up for each other.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {principles.map(p => (
                <div key={p.title} className="rounded-2xl border border-stone-200 p-6">
                  <h3 className="font-semibold text-stone-900 mb-1.5">{p.title}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-orange-500 py-16">
          <div className="max-w-xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to bring your people together?</h2>
            <p className="text-orange-100 mb-6 text-base">Welcome to Stoke. Go build something reciprocal.</p>
            <Link
              href={user ? '/communities/new' : '/signup'}
              className="inline-block bg-white text-orange-600 font-semibold px-6 py-3 rounded-xl hover:bg-orange-50 transition-colors"
            >
              {user ? 'Create a community' : 'Create a free account'}
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
