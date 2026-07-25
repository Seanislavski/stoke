import { getGuideAccess } from '@/lib/guide-access'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Capturing Discord posts',
  description:
    'How moderators use Silas! to rescue great Discord posts into the community Q&A library on Stoke — with the author’s recorded permission.',
}

type Who = 'mod' | 'author' | 'silas'

const whoStyles: Record<Who, string> = {
  mod: 'text-violet-600',
  author: 'text-cyan-600',
  silas: 'text-yellow-600',
}

const toc = [
  { href: '#how', label: 'How it works' },
  { href: '#need', label: 'What you need' },
  { href: '#steps', label: 'Step by step' },
  { href: '#trouble', label: 'Troubleshooting' },
  { href: '#etiquette', label: 'Etiquette' },
  { href: '#quick', label: 'Quick reference' },
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

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed">
      {children}
    </div>
  )
}

function Good({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-800 leading-relaxed">
      {children}
    </div>
  )
}

/**
 * A screenshot slot. Renders the image once `src` is supplied; until then it
 * shows a labelled placeholder so the guide is readable while shots are pending.
 */
function Shot({ src, alt, caption }: { src?: string; alt: string; caption: React.ReactNode }) {
  return (
    <figure className="mt-4">
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full rounded-xl border border-stone-200 bg-white"
        />
      ) : (
        <div className="rounded-xl border-2 border-dashed border-orange-300 bg-orange-50/40 px-4 py-10 text-center">
          <p className="text-xs uppercase tracking-widest text-orange-500 font-semibold">Screenshot coming</p>
          <p className="text-sm text-stone-500 mt-1.5 max-w-md mx-auto">{alt}</p>
        </div>
      )}
      <figcaption className="text-sm text-stone-500 mt-2 leading-relaxed">{caption}</figcaption>
    </figure>
  )
}

function Step({
  n,
  who,
  whoLabel,
  title,
  children,
}: {
  n: number
  who: Who
  whoLabel: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-5">
      <span className="shrink-0 w-10 h-10 rounded-full bg-orange-50 border-2 border-orange-300 text-orange-600 font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs uppercase tracking-wider font-bold ${whoStyles[who]}`}>{whoLabel}</p>
        <h3 className="text-lg font-semibold text-stone-900 mt-0.5">{title}</h3>
        <div className="space-y-3 text-stone-600 leading-relaxed mt-2">{children}</div>
      </div>
    </div>
  )
}

const troubles: { seen: string; meaning: React.ReactNode }[] = [
  {
    seen: '“Only moderators can capture posts for Stoke.”',
    meaning: 'You don’t hold the capture role or Manage Messages in that channel. Ask an admin.',
  },
  {
    seen: '“Capture isn’t configured on this bot.”',
    meaning: 'Silas! is missing its Stoke connection settings. This one’s for Sean, not you.',
  },
  {
    seen: '“📚 Already on my desk.”',
    meaning: 'That message was captured before and is pending or already filed. Check the review queue.',
  },
  {
    seen: 'Silas! asked in the channel instead of by DM',
    meaning: 'The author’s DMs are closed. This is fine and safe — only they can click the buttons.',
  },
  { seen: '“I can’t capture bot messages.”', meaning: 'Only human posts can be shelved.' },
  {
    seen: '“That message has no text or image to archive.”',
    meaning: 'Nothing to save — an emoji-only or link-only reaction, for instance.',
  },
  {
    seen: 'Consented, but nothing in the queue',
    meaning: 'Already filed, or discarded. Check the Q&A library and the community audit log.',
  },
  {
    seen: 'Author asked to be removed after saying yes',
    meaning:
      'Delete the published question or answer on Stoke — that dismisses the capture too, so it won’t bounce back into the queue. Then tell them it’s done.',
  },
]

export default async function CaptureGuidePage() {
  // Same staff gate as the organizer guide: community organizers/moderators and
  // platform staff only. Shared with the route that serves this page's screenshots.
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
              Turning great Discord posts into a lasting library
            </h1>
            <p className="text-orange-50 leading-relaxed mt-4 max-w-2xl">
              Someone shares hard-won advice in Discord. Three days later it’s buried in the scroll and nobody can find
              it again. This is how you and Silas! rescue it — with the author’s permission, on the record — and shelve
              it in the community’s Q&amp;A library on Stoke.
            </p>
            <p className="inline-block mt-6 text-sm font-semibold text-white bg-white/20 rounded-full px-4 py-1.5">
              For moderators of the Body Doubling Discord
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

          <Section id="how" eyebrow="The 30-second version" title="How it works">
            <p>
              Two systems, one hand-off. <strong className="text-stone-900">Silas!</strong> lives in Discord and does
              the asking. <strong className="text-stone-900">Stoke</strong> holds the library and the permission record.
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                You right-click a good post in Discord and choose <strong className="text-stone-900">Capture for Stoke</strong>.
              </li>
              <li>
                Silas! DMs the author — as the community’s resident librarian — and asks permission:{' '}
                <strong className="text-stone-900">yes with credit</strong>,{' '}
                <strong className="text-stone-900">yes anonymously</strong>, or{' '}
                <strong className="text-stone-900">no</strong>.
              </li>
              <li>
                Their answer is recorded in Stoke, timestamped, right next to the post.{' '}
                <strong className="text-stone-900">Nothing publishes while permission is pending, ever.</strong>
              </li>
              <li>
                Once they say yes, the capture appears in your{' '}
                <strong className="text-stone-900">review queue on Stoke</strong>, where you file it as an answer to an
                existing question or as a new one.
              </li>
              <li>
                If they asked for credit, they get a personal <strong className="text-stone-900">claim link</strong> — so
                the post can move onto their own Stoke profile whenever they sign up, even months later.
              </li>
            </ol>
            <Note>
              <strong>Why the permission step matters.</strong> We are moving someone’s words from a semi-private chat to
              a permanent, linkable library. Consent isn’t a formality here — it’s the whole design. A “no” is recorded
              and honored, and it stays a no.
            </Note>
          </Section>

          <Section id="need" eyebrow="Before you start" title="What you need">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                The <strong className="text-stone-900">Manage Messages</strong> permission in the Discord server (or the
                designated capture role) — that’s what gates the command.
              </li>
              <li>
                A <strong className="text-stone-900">Stoke account</strong> that is an organizer or moderator of the Body
                Doubling community, so you can see the review queue. (If you’re reading this page, you have it.)
              </li>
              <li>Nothing to install. The command is already registered on Silas!.</li>
            </ul>
          </Section>

          <Section id="steps" eyebrow="Step by step" title="Capturing a post">
            <div className="space-y-10 pt-2">
              <Step n={1} who="mod" whoLabel="You, in Discord" title="Spot something worth keeping">
                <p>
                  The test: <em>would a member six months from now be glad they found this?</em> Good candidates are
                  concrete tips, a routine that works, a tool recommendation with the reason behind it, a thoughtful
                  answer to a question that gets asked a lot. Skip the chatter, the venting, and anything personal or
                  clearly in-the-moment.
                </p>
                <Shot
                  src="/guide/capture/shots/01-message.png"
                  alt="A Discord message showing capture-worthy practical advice"
                  caption="A real post in the server — a few sentences of practical, durable advice."
                />
              </Step>

              <Step n={2} who="mod" whoLabel="You, in Discord" title="Right-click the message → Apps → 📚 Capture for Stoke">
                <p>
                  On desktop, right-click the message (on mobile, long-press it) and open the{' '}
                  <strong className="text-stone-900">Apps</strong> submenu. Choose{' '}
                  <strong className="text-stone-900">Capture for Stoke</strong>. If you don’t see it, you’re missing the
                  moderator permission — that’s the gate, not a bug.
                </p>
                <p>
                  Images come along automatically. If the post has photos attached, Silas! copies them into Stoke’s own
                  storage right then, because Discord’s image links expire after about a day.
                </p>
                <Shot
                  src="/guide/capture/shots/02-apps-menu.png"
                  alt="The right-click context menu with the Apps submenu open, showing 📚 Capture for Stoke"
                  caption="The Apps submenu, with 📚 Capture for Stoke in the list."
                />
              </Step>

              <Step n={3} who="silas" whoLabel="Silas! confirms, privately" title="You get a quiet confirmation">
                <p>
                  Silas! replies only to you — nobody else in the channel sees it. It tells you the capture landed and{' '}
                  <em>how</em> the author was asked: normally by DM, or as a reply in the channel if their DMs are
                  closed.
                </p>
                <p>
                  That’s your whole job in Discord. Don’t nudge the author, don’t explain, don’t apologize — the
                  librarian’s ask is written to be warm and pressure-free, and it does the work for you.
                </p>
                <Shot
                  src="/guide/capture/shots/03-confirm.png"
                  alt="An ephemeral “Only you can see this” reply from Silas confirming the capture"
                  caption="“📚 Captured. I’ve asked [name] for permission (via DM) — once they answer, it appears in the Stoke captures inbox.”"
                />
              </Step>

              <Step n={4} who="author" whoLabel="The author, in their DMs" title="Silas! asks permission">
                <p>
                  The author gets a card from their librarian:{' '}
                  <strong className="text-stone-900">“📚 May I shelve this in the library?”</strong> It quotes their own
                  post back to them, mentions any images coming along, and offers three buttons. The footer says the
                  quiet part out loud: <em>“Your choice is recorded either way. No pressure — ‘no’ is a perfectly good
                  answer.”</em>
                </p>
                <Shot
                  src="/guide/capture/shots/04-consent-dm.png"
                  alt="The full consent DM from Silas — orange embed, the quoted post, and three buttons"
                  caption="The consent card, with ✅ Yes, with credit · 👤 Yes, anonymously · ❌ No thanks."
                />
              </Step>

              <Step n={5} who="author" whoLabel="The author chooses" title="Three answers, three outcomes">
                <div className="space-y-2.5">
                  <div className="flex gap-3 items-start rounded-xl border border-stone-200 bg-white p-3.5">
                    <span className="shrink-0 text-xs font-bold rounded-full bg-green-100 text-green-700 px-2.5 py-1">
                      ✅ With credit
                    </span>
                    <p className="text-sm text-stone-600">
                      <strong className="text-stone-900">Shelved under their name.</strong> The library entry reads “📚
                      Shared by [name] on Discord.” They also get a private claim link so the post can become theirs on
                      Stoke later.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start rounded-xl border border-stone-200 bg-white p-3.5">
                    <span className="shrink-0 text-xs font-bold rounded-full bg-stone-100 text-stone-600 px-2.5 py-1">
                      👤 Anonymously
                    </span>
                    <p className="text-sm text-stone-600">
                      <strong className="text-stone-900">Shelved as “a community member.”</strong> The advice lives on;
                      their name never appears anywhere on Stoke.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start rounded-xl border border-stone-200 bg-white p-3.5">
                    <span className="shrink-0 text-xs font-bold rounded-full bg-red-100 text-red-700 px-2.5 py-1">
                      ❌ No thanks
                    </span>
                    <p className="text-sm text-stone-600">
                      <strong className="text-stone-900">Nothing is published. Ever.</strong> The decline is recorded —
                      proof we asked and honored the answer. Don’t re-ask; if it comes up again, ask them yourself, in
                      person, first.
                    </p>
                  </div>
                </div>
                <p>
                  Once they click, the buttons disappear and Silas! confirms in their own words. They can’t be
                  double-asked, and only the original author can answer — even if the ask had to happen in the channel.
                </p>
                <Shot
                  src="/guide/capture/shots/05-answered.png"
                  alt="The answered consent card with buttons gone, plus the claim-link follow-up"
                  caption="“✅ Wonderful — I’ll shelve it with your name on it.” — followed by the private claim link."
                />
              </Step>

              <Step n={6} who="mod" whoLabel="You, on Stoke" title="Granted captures land in your review queue">
                <p>
                  Open the Body Doubling community on Stoke and click the{' '}
                  <strong className="text-stone-900">⚙️ gear</strong> in the header →{' '}
                  <strong className="text-stone-900">Review queue</strong>. The number on the gear includes captures
                  waiting to be filed, so you don’t have to go looking.
                </p>
                <p>
                  Scroll to <strong className="text-stone-900">Discord captures</strong>. Each card shows who consented
                  (or “Anonymous (by request)”), when they consented, the post text, any images, and an{' '}
                  <strong className="text-stone-900">original ↗</strong> link straight back to the Discord message.
                  Pending and declined captures never appear here — this list is consent-granted only.
                </p>
                <Shot
                  src="/guide/capture/shots/06-gear-menu.png"
                  alt="The community header gear menu open, showing Review queue with its pending count badge"
                  caption="The gear menu — the badge tells you something’s waiting."
                />
                <Shot
                  src="/guide/capture/shots/07-captures-queue.png"
                  alt="The Discord captures section of the review queue with a capture card"
                  caption="A capture card: who shared it, when they consented, the post text, and a link back to the original."
                />
              </Step>

              <Step n={7} who="mod" whoLabel="You, on Stoke" title="File it into the library">
                <p>Every capture card gives you two ways to shelve it and one way to let it go:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong className="text-stone-900">Answer to a question</strong> — pick an existing question from the
                    dropdown and hit <strong className="text-stone-900">Publish answer</strong>. Use this whenever the
                    post answers something people already ask. It’s the choice that makes the library feel alive.
                  </li>
                  <li>
                    <strong className="text-stone-900">New question</strong> — type a question title; the captured post
                    becomes the first answer body. Use this when the advice is great but has no home yet. Write the title
                    as a real question someone would search for.
                  </li>
                  <li>
                    <strong className="text-stone-900">Discard</strong> — permission was given but on reflection it
                    doesn’t belong in the library. Nothing publishes, and the consent record stays.
                  </li>
                </ul>
                <p>
                  Filed captures publish immediately — no second approval queue. You already curated by choosing to
                  capture it.
                </p>
                <Shot
                  src="/guide/capture/shots/08-filing.png"
                  alt="The filing controls on a capture card, showing the New question tab with a title field"
                  caption="Answer to a question / New question. Here it’s being filed as a new question — type the title, then Publish."
                />
              </Step>

              <Step n={8} who="silas" whoLabel="In the library" title="How it looks once shelved">
                <p>
                  Published captures are posted by <strong className="text-stone-900">Silas!</strong> on Stoke, with an
                  attribution line where the author’s profile link would normally be:{' '}
                  <strong className="text-stone-900">“📚 Shared by [name] on Discord”</strong> — or “a community member”
                  for anonymous ones. Any photos appear right below. It’s searchable, linkable, and permanent.
                </p>
                <Shot
                  src="/guide/capture/shots/09-published.png"
                  alt="The published question on its Q&A page, showing the “Shared by … on Discord” attribution line"
                  caption="The payoff: the advice in its new, findable home, credited back to whoever wrote it."
                />
              </Step>

              <Step n={9} who="author" whoLabel="The author, whenever they’re ready" title="The claim link closes the loop">
                <p>
                  Credited authors get a private link like{' '}
                  <code className="rounded bg-stone-100 border border-stone-200 px-1.5 py-0.5 text-[13px] text-orange-700">
                    stoke.community/claim/…
                  </code>{' '}
                  Whenever they open it — today or next year — the post is re-attributed to their own Stoke profile: their
                  name, their avatar, their contribution. If they don’t have an account yet, the link walks them through
                  signing up and still works afterward.
                </p>
                <p>
                  This is the gentlest possible invitation to Stoke:{' '}
                  <em>you already contributed something valuable here — come put your name on it.</em> Nobody is asked to
                  “join a platform.”
                </p>
                <Shot
                  src="/guide/capture/shots/10-claim.png"
                  alt="The claim page on Stoke, showing the captured post and the claim button"
                  caption="The claim page — one click and it’s theirs."
                />
              </Step>
            </div>
          </Section>

          <Section id="trouble" eyebrow="When things get odd" title="Troubleshooting">
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-stone-100">
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-stone-400 font-semibold">
                      What you see
                    </th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-stone-400 font-semibold">
                      What’s going on
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {troubles.map(t => (
                    <tr key={t.seen} className="border-b border-stone-100 last:border-0 align-top">
                      <td className="px-4 py-3 font-medium text-stone-900 w-2/5">{t.seen}</td>
                      <td className="px-4 py-3 text-stone-600">{t.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="etiquette" eyebrow="Good practice" title="The etiquette">
            <Good>
              <strong>Do:</strong> capture generously — asking is cheap and flattering. File promptly so people see their
              contribution land. Write question titles the way a member would search. Say thank you in the channel when
              someone’s post gets shelved.
            </Good>
            <Warn>
              <strong>Don’t:</strong> pressure anyone who hasn’t answered, re-ask someone who declined, capture anything
              personal or vulnerable “because it’s good advice,” or edit someone’s words into something they didn’t say.
              Light cleanup at filing time is fine; rewriting their meaning is not.
            </Warn>
            <Note>
              <strong>Everything is on the record.</strong> Every capture, consent answer, publish, discard, and claim is
              logged with a timestamp in Stoke’s audit log, viewable by organizers. That’s there to protect members — and
              to protect you.
            </Note>
          </Section>

          {/* Quick reference */}
          <section id="quick" className="scroll-mt-20 rounded-2xl bg-stone-900 p-8">
            <p className="text-xs uppercase tracking-widest text-orange-300 font-semibold">Print this bit</p>
            <h2 className="text-2xl font-bold text-white mt-1.5 mb-5">Quick reference</h2>
            <ol className="list-decimal pl-5 space-y-2.5 text-stone-300">
              <li>
                <strong className="text-white">Discord:</strong> right-click the post → Apps → 📚 Capture for Stoke
              </li>
              <li>
                <strong className="text-white">Silas!</strong> DMs the author for permission — you do nothing, and
                nothing publishes yet
              </li>
              <li>
                <strong className="text-white">Stoke:</strong> ⚙️ gear → Review queue → Discord captures
              </li>
              <li>
                <strong className="text-white">File it:</strong> answer to an existing question, or a new question
              </li>
              <li>
                <strong className="text-white">Done</strong> — it’s in the library, credited, searchable, and theirs to
                claim
              </li>
            </ol>
          </section>

          <p className="text-sm text-stone-400 text-center">
            Questions or something broken?{' '}
            <a href="mailto:support@stoke.community" className="text-orange-600 hover:underline">
              support@stoke.community
            </a>
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
