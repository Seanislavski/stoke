// User-facing changelog — the source for the public /changelog page AND for announcement
// copy (Discord, etc.). Curated on purpose: add an entry only for changes a MEMBER would
// notice, in plain language. Internal work (cron fixes, refactors, docs) does NOT go here.
// Newest entry first. Keep bullets short and benefit-led ("You can now…").

export type ChangelogEntry = {
  date: string   // 'YYYY-MM-DD'
  title: string  // short headline for the release
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-07-26',
    title: 'Question links now work for people who haven\'t joined yet',
    items: [
      'Following a link to a community question no longer shows "not found" if you haven\'t joined that community. You can read the question, see how many answers it has, and join right there to read them.',
    ],
  },
  {
    date: '2026-07-24',
    title: 'Captured Discord posts keep their pictures, and a new Photos tab',
    items: [
      'When a great Discord post with a photo is archived into the Q&A library, the image now comes along — so screenshots, diagrams, and photos are preserved with the advice, not left behind.',
      'Communities now have a Photos tab, giving the community gallery its own home.',
    ],
  },
  {
    date: '2026-07-23',
    title: 'Great Discord advice can now live on in the library',
    items: [
      'Moderators can now archive a standout Discord post into the community\'s Q&A library — but only after the original author says yes. Silas the librarian asks them directly, and their choice (credited, anonymous, or no) is always recorded and respected.',
      'Archived posts show a "Shared by … on Discord" credit. If the author later joins Stoke, a personal claim link puts the post under their own profile — even months later.',
    ],
  },
  {
    date: '2026-07-10',
    title: 'Reply to messages, plus editing and undo',
    items: [
      'You can now reply directly to a specific message — your reply shows a little quote of the original, and tapping it jumps to the original and briefly highlights it.',
      'Reply to someone and they get a notification, so it\'s easy to keep a back-and-forth going without missing it.',
      'You can now edit a message after sending it in a channel — just hover (or tap) and choose the pencil. Edited messages show a small "(edited)" note.',
      'Changed your mind? An "Undo edit" option restores your previous wording in one click.',
    ],
  },
  {
    date: '2026-07-08',
    title: 'Recurring events, richer community pages, and timezone-aware times',
    items: [
      'Communities now have an "About" section — organizers can add the full story (mission, who it\'s for, how it works, schedule) right at the top of the community page.',
      'Communities can now have a wide cover image and a photo gallery, so a community page shows off its personality at a glance.',
      'Organizers can now create repeating events — weekly, every 2 weeks, or monthly — that end after a set number of times, on a date, or keep going until you turn them off.',
      'Deleting a repeating event lets you remove just that occurrence, this and all following, or the whole series.',
      'Event times now show in your own timezone, with the zone labeled — no more mental math.',
      'We set your timezone automatically from your browser. You can change it anytime under Settings → Profile.',
      'Events that are underway now stay in the upcoming list with a "Happening now" tag, instead of disappearing into past events the moment they start.',
    ],
  },
  {
    date: '2026-07-07',
    title: 'Editing, a review queue, and cleaner menus',
    items: [
      'You can now edit your questions and answers after posting — no more deleting and re-posting to fix a typo.',
      'Organizers get a new Review queue: everything waiting for approval (join requests, posts, questions, answers, reviews) now lives in one place instead of being scattered.',
      'Cleaner community menus — the gear now opens a quick menu (Review queue, Question of the Week, Settings, Audit log), and Settings has a jump-to-section nav.',
      'Your role now shows in the community header (Owner, Organizer, or Moderator).',
      'This page! You can now see everything new on Stoke on the "What\'s new" page.',
    ],
  },
  {
    date: '2026-07-06',
    title: 'Question of the Week',
    items: [
      'The Question of the Week is here — a fresh community question with its own permanent, shareable link and no deadline to answer.',
      'Organizers can stockpile questions ahead of time and let a new one publish automatically each week.',
    ],
  },
  {
    date: '2026-07-05',
    title: 'Reactions and public sharing',
    items: [
      'React to channel messages with emoji.',
      'Organizers can make an individual question public so it can be shared with anyone — while the answers stay members-only.',
    ],
  },
]
