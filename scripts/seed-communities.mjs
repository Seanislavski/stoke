// Seed script: populate Stoke with believable demo communities + activity.
// All fake accounts use @seed.stoke.community emails so they can be bulk-removed
// later with scripts/unseed-communities.mjs.
//
// Run from repo root:  node scripts/seed-communities.mjs
//
// Idempotent: re-running reuses existing seed users/communities by email/slug.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ---- load env from apps/web/.env.local --------------------------------------
function loadEnv() {
  const raw = readFileSync(join(ROOT, 'apps', 'web', '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[m[1]] = val
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local')
  process.exit(1)
}

const SEED_DOMAIN = 'seed.stoke.community'
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---- small helpers ----------------------------------------------------------
const rand = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rand(arr.length)]
const sample = (arr, k) => {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(k, copy.length))
}
const daysAgo = (d, jitterHours = 0) =>
  new Date(Date.now() - d * 864e5 - rand(jitterHours) * 36e5).toISOString()
const daysFromNow = (d, hour = 18) => {
  const dt = new Date(Date.now() + d * 864e5)
  dt.setHours(hour, 0, 0, 0)
  return dt.toISOString()
}

// ---- fake users -------------------------------------------------------------
// username must be unique; emails are username@seed.stoke.community
const PEOPLE = [
  ['maya-okafor', 'Maya Okafor', 'Community organizer by day, ceramicist by night.'],
  ['daniel-reyes', 'Daniel Reyes', 'Carpenter who believes every block needs a tool library.'],
  ['priya-nair', 'Priya Nair', 'Software engineer learning to slow down.'],
  ['liam-fitzgerald', 'Liam Fitzgerald', 'New dad, perpetual sourdough experimenter.'],
  ['sofia-rossi', 'Sofia Rossi', 'Watercolorist. I trade prints for plants.'],
  ['marcus-bell', 'Marcus Bell', 'Trail runner and amateur cartographer.'],
  ['aisha-khan', 'Aisha Khan', 'ESL teacher. Languages are how we meet each other.'],
  ['noah-andersen', 'Noah Andersen', 'Freelance designer, here to swap skills.'],
  ['elena-petrova', 'Elena Petrova', 'Retired nurse, full-time caregiver advocate.'],
  ['james-osei', 'James Osei', 'Woodworker, repair-café regular.'],
  ['hana-tanaka', 'Hana Tanaka', 'Urban gardener with too many tomato seedlings.'],
  ['oliver-grant', 'Oliver Grant', 'Bootstrapped founder, three failures and counting.'],
  ['fatima-zahra', 'Fatima Zahra', 'Mutual aid coordinator. Solidarity not charity.'],
  ['ben-carter', 'Ben Carter', 'Cyclist, bike-mechanic-in-training.'],
  ['lucia-mendez', 'Lucia Mendez', 'Potter and weekend market vendor.'],
  ['tom-bradley', 'Tom Bradley', 'Dad of two, reluctant minivan owner, board game hoarder.'],
  ['grace-lim', 'Grace Lim', 'Yoga instructor exploring community wellness.'],
  ['samuel-wright', 'Samuel Wright', 'Librarian. I will recommend you a book unprompted.'],
  ['nadia-hassan', 'Nadia Hassan', 'UX researcher, language-exchange addict.'],
  ['eric-johansson', 'Eric Johansson', 'Hobby electronics, fixes things for fun.'],
  ['rosa-delgado', 'Rosa Delgado', 'Community kitchen volunteer, recipe collector.'],
  ['kevin-park', 'Kevin Park', 'Product manager, weekend hiker.'],
  ['amara-diallo', 'Amara Diallo', 'Muralist and youth arts mentor.'],
  ['paul-novak', 'Paul Novak', 'Retired engineer, repair-café fixer.'],
  ['leah-goldberg', 'Leah Goldberg', 'New parent navigating it all, one nap at a time.'],
  ['hugo-martins', 'Hugo Martins', 'Climber, gear-swap enthusiast.'],
  ['ingrid-larsen', 'Ingrid Larsen', 'Knitter, founder of three abandoned craft circles.'],
  ['omar-saleh', 'Omar Saleh', 'Photographer documenting neighbourhood change.'],
  ['chloe-dubois', 'Chloe Dubois', 'Pastry hobbyist, croissant evangelist.'],
  ['ryan-walsh', 'Ryan Walsh', 'Indie game dev, coffee shop regular.'],
  ['tara-singh', 'Tara Singh', 'Therapist interested in peer-support models.'],
  ['victor-ramos', 'Victor Ramos', 'Mechanic, teaches free car-care nights.'],
  ['ellie-thompson', 'Ellie Thompson', 'Birder, leads weekend nature walks.'],
  ['malik-jones', 'Malik Jones', 'DJ and audio-gear tinkerer.'],
  ['sara-lindqvist', 'Sara Lindqvist', 'Sustainability nerd, clothes-swap organizer.'],
  ['gabriel-costa', 'Gabriel Costa', 'Chess club refugee looking for a new table.'],
  ['yuki-mori', 'Yuki Mori', 'Calligrapher and stationery obsessive.'],
  ['hannah-bauer', 'Hannah Bauer', 'Midwife, doula, mutual-aid believer.'],
  ['isaac-cohen', 'Isaac Cohen', 'Maker, 3D-printing for the neighbourhood.'],
  ['nina-popova', 'Nina Popova', 'Translator and book-club ringleader.'],
  ['felix-weber', 'Felix Weber', 'Bee-keeper, honey-for-help economy.'],
  ['zoe-clark', 'Zoe Clark', 'Volunteer driver, gets folks to appointments.'],
  ['andre-silva', 'Andre Silva', 'Capoeira instructor building community through movement.'],
  ['mei-wong', 'Mei Wong', 'Accountant who does free tax help in spring.'],
  ['jonah-fisher', 'Jonah Fisher', 'Permaculture tinkerer, seed-library steward.'],
]

// ---- communities ------------------------------------------------------------
// categorySlug must match one of the seeded categories.
const COMMUNITIES = [
  {
    name: 'Tools & Hands',
    categorySlug: 'neighborhood-local',
    join_mode: 'open',
    description:
      'A neighbourhood tool library and skill-swap. Borrow a drill, lend an afternoon. Members offer what they know — plumbing, sewing, bike repair — and take what they need.',
    channels: [
      ['general', 'Introductions and everyday chatter'],
      ['tool-requests', 'Need to borrow something? Ask here'],
      ['skill-swap', 'Offer or request a skill'],
    ],
    bulletin: [
      ['New: cordless drill set in the library', 'Picked up a gently-used DeWalt set at an estate sale. It lives in the back cabinet now — sign it out on the clipboard. Please return charged!'],
      ['Saturday repair morning recap', 'Eleven people, six fixed lamps, one resurrected toaster, and a lot of coffee. Thank you to everyone who brought tools and patience. Same time next month.'],
      ['Looking for: someone who knows tile', 'Re-doing a small bathroom and completely out of my depth. Happy to trade — I can do basic electrical or watch your kids for an afternoon.'],
    ],
    events: [
      ['Monthly Repair Café', 'Bring anything broken — small appliances, clothing, bikes, furniture. Our volunteer fixers will help you mend it instead of binning it.', 9, 'in_person'],
      ['Tool Library Orientation', 'New to the library? Drop in for a quick walkthrough of how borrowing works and what we have.', 21, 'in_person'],
    ],
  },
  {
    name: 'New Parents Exchange',
    categorySlug: 'support-mutual-aid',
    join_mode: 'request',
    description:
      'For new and expecting parents trading the things that get you through: hand-me-down gear, overnight advice, a meal when the week falls apart. Give when you can, ask when you need to.',
    channels: [
      ['general', 'Say hi and find your people'],
      ['gear-handoffs', 'Pass on outgrown clothes, carriers, and gear'],
      ['3am-club', 'For the ones who are awake'],
    ],
    bulletin: [
      ['Meal train for the Okafor family', 'Maya just welcomed baby number two. If you can drop off a freezer meal this week, add your name to the list. No cooking heroics required — store-bought is love too.'],
      ['Bin of 0–3mo clothes, free to a good home', 'Gender-neutral, all washed and folded. First to claim it gets it. Would rather it go to someone here than a landfill.'],
      ['Honest question about sleep regressions', 'Four-month-old who was sleeping beautifully has decided sleep is for the weak. Tell me it ends. Tell me anything.'],
    ],
    events: [
      ['Stroller Walk & Coffee', 'Low-key loop around the park at toddler pace. Babies, coffee, and adult conversation. Rain cancels.', 6, 'in_person'],
      ['Evening Q&A with a Lactation Consultant', 'Hannah is hosting an informal video call to answer feeding questions. No topic too small or too awkward.', 14, 'online'],
    ],
  },
  {
    name: 'Code & Coffee Collective',
    categorySlug: 'professional-career',
    join_mode: 'open',
    description:
      'Developers helping developers. Pair on a bug, review a résumé, mock-interview a friend, or just co-work over coffee. The exchange is knowledge — bring some, take some.',
    channels: [
      ['general', 'Tech chat and hellos'],
      ['code-review', 'Post a PR or snippet for feedback'],
      ['job-leads', 'Share openings and referrals'],
    ],
    bulletin: [
      ['Offering mock interviews this month', 'Senior backend eng here. I have a few slots for system-design or behavioural mocks. Free — pay it forward when you land somewhere.'],
      ['Anyone strong with PostgreSQL query plans?', 'Got a report query that takes 40 seconds and I cannot figure out why. Will trade a thorough frontend review for an hour of your time.'],
      ['Weekly co-working is back on', 'Thursdays 9am, same video room. Cameras optional, focus encouraged. Come body-double your way through the hard tickets.'],
    ],
    events: [
      ['Thursday Co-working Session', 'Two hours of quiet, focused co-working over video. Pop in, state your goal, get it done alongside others.', 4, 'online'],
      ['Résumé Review Night', 'Bring your résumé or LinkedIn. We pair up and give each other real, specific feedback.', 18, 'online'],
    ],
  },
  {
    name: 'Open Studio Collective',
    categorySlug: 'arts-creativity',
    join_mode: 'open',
    description:
      'Painters, potters, printmakers, and the perpetually unfinished. Share a studio day, swap technique, trade work, and critique kindly. Make more by making together.',
    channels: [
      ['general', 'Studio talk and introductions'],
      ['critique-corner', 'Post work for friendly critique'],
      ['materials-swap', 'Trade supplies you will never use'],
    ],
    bulletin: [
      ['Free: half a bolt of linen canvas', 'Bought too much, as always. Come take some off my hands before it becomes a guilt object in my closet.'],
      ['Print swap is happening!', 'Twelve of us are in so far. Bring an edition of any small print and go home with eleven others. Details in #materials-swap.'],
      ['Looking for a kiln share', 'My pieces are stacking up unfired. Anyone with kiln space willing to trade firings for help loading/glazing?'],
    ],
    events: [
      ['Open Studio Saturday', 'Bring your current project and work alongside the collective. Snacks, music, and gentle accountability.', 8, 'in_person'],
      ['Group Critique Night', 'Bring one piece you are stuck on. We look closely, ask good questions, and help you find the next move.', 22, 'in_person'],
    ],
  },
  {
    name: 'Trail & Summit Club',
    categorySlug: 'health-wellness',
    join_mode: 'open',
    description:
      'Hikers and trail runners sharing routes, gear, and rides to the trailhead. New to the outdoors? We pair beginners with regulars so nobody hikes alone.',
    channels: [
      ['general', 'Trail talk and meetups'],
      ['route-beta', 'Share conditions and route notes'],
      ['carpool', 'Coordinate rides to trailheads'],
    ],
    bulletin: [
      ['Beginner-friendly hike this weekend', 'Five miles, gentle climb, lots of stops. Perfect if you have been wanting to start. We will lend trekking poles if you need them.'],
      ['Gear library update', 'We now have two extra sets of microspikes and a kids carrier in the loaner stash. Borrow before you buy.'],
      ['Trail conditions: Ridge Loop', 'Hiked it yesterday — muddy first mile, then perfect. Stream crossing is ankle-deep. Wildflowers are unreal right now.'],
    ],
    events: [
      ['Sunrise Summit Hike', 'Early start for the big view. Moderate pace, 7 miles round trip. Carpools forming in #carpool.', 5, 'in_person'],
      ['Trailhead Cleanup & Easy Loop', 'Pick up litter, then enjoy a relaxed 3-mile loop. Bags and gloves provided.', 16, 'in_person'],
    ],
  },
  {
    name: 'Language Exchange Roundtable',
    categorySlug: 'learning-education',
    join_mode: 'open',
    description:
      'Practice a language by teaching yours. Spanish for Japanese, French for Arabic, ASL for anyone. Pairs and small groups, all levels, zero judgement.',
    channels: [
      ['general', 'Introductions and partner-finding'],
      ['spanish-table', 'Práctica en español'],
      ['conversation-help', 'Ask about grammar, idioms, slang'],
    ],
    bulletin: [
      ['Seeking a Japanese ↔ English partner', 'Intermediate Japanese, native English. Happy to meet weekly over video. I can help with anything from emails to interview prep.'],
      ['New: weekly Spanish conversation table', 'Casual, all levels, no textbooks. We pick a topic and just talk. First one is this Wednesday — bring your mistakes.'],
      ['Idiom of the week thread', 'Drop a saying from your language that does not translate. I will start: "no tener pelos en la lengua" — to have no hairs on your tongue (to speak bluntly).'],
    ],
    events: [
      ['Spanish Conversation Table', 'One hour of relaxed Spanish practice over video. Topic announced the day before. All levels welcome.', 3, 'online'],
      ['Multilingual Game Night', 'Play simple party games in whatever language you are learning. Chaos and laughter guaranteed.', 19, 'online'],
    ],
  },
  {
    name: 'Neighbourhood Plant Swap',
    categorySlug: 'hobbies-interests',
    join_mode: 'open',
    description:
      'Cuttings, seedlings, divisions, and plant wisdom, freely traded. Overrun with pothos? Bring it. Killed another fern? We will help. Greener block, one clipping at a time.',
    channels: [
      ['general', 'Plant chat and swaps'],
      ['help-my-plant', 'Diagnose droops and spots here'],
      ['cuttings-available', 'Post what you can share'],
    ],
    bulletin: [
      ['Tomato seedlings, way too many', 'Started a flat of forty. I have a balcony. Come rescue these before they unionize. Heirloom varieties, labelled.'],
      ['Monstera divisions ready', 'Repotted the big one and got six healthy divisions. Trade for anything trailing, or just take one.'],
      ['What is wrong with my fiddle leaf?', 'Brown crispy edges, dropping leaves near the window. Photos in #help-my-plant. I am attached to this dramatic tree, please advise.'],
    ],
    events: [
      ['Spring Plant Swap', 'Bring cuttings, seedlings, pots, or tools to trade. Take home something new for your windowsill.', 11, 'in_person'],
      ['Repotting Workshop', 'Learn when and how to repot. Bring a root-bound plant and we will sort it out together. Soil provided.', 24, 'in_person'],
    ],
  },
  {
    name: 'Caregivers Connect',
    categorySlug: 'support-mutual-aid',
    join_mode: 'request',
    description:
      'For people caring for aging parents, partners, or family with chronic illness. Trade respite hours, share what works, and remind each other to breathe. You are not doing this alone.',
    channels: [
      ['general', 'Check in and connect'],
      ['respite-swap', 'Trade a few hours of relief'],
      ['resources', 'Share services, tips, paperwork help'],
    ],
    bulletin: [
      ['Offering respite hours this week', 'I have Thursday afternoon free and would gladly sit with your loved one so you can get out. Done it for years — happy to help someone here.'],
      ['What helped me with the paperwork maze', 'Finally got through the benefits application. Writing up the steps that worked so the next person does not lose a week to it. See #resources.'],
      ['Just need to say it was a hard week', 'No advice needed. Just wanted to put it somewhere that people understand. Thank you for being here.'],
    ],
    events: [
      ['Caregiver Coffee & Vent', 'A gentle, confidential video circle. Share as much or as little as you want. No fixing, just company.', 7, 'online'],
      ['Info Session: Local Respite Services', 'A volunteer walks through what respite options exist locally and how to access them. Q&A after.', 20, 'online'],
    ],
  },
  {
    name: 'The Makerspace',
    categorySlug: 'hobbies-interests',
    join_mode: 'open',
    description:
      '3D printing, electronics, laser cutting, and the joy of building things. Share machine time, swap filament, teach a beginner, fix the neighbourhood gadget. Make, break, learn, repeat.',
    channels: [
      ['general', 'Project show-and-tell'],
      ['print-queue', 'Request a print or offer machine time'],
      ['electronics', 'Soldering, sensors, and smoke'],
    ],
    bulletin: [
      ['Filament swap drawer is live', 'Got a bin of partial spools — PLA, PETG, a little TPU. Take what you need, leave what you do not. Colours change weekly.'],
      ['I will print your replacement part free', 'If you have a broken plastic clip, knob, or bracket, send me the dimensions or a photo. Keeping things out of the bin one print at a time.'],
      ['Beginner soldering night — who is in?', 'Thinking of running an intro session. Bring nothing, leave able to fix a frayed cable. Reply if interested and I will pick a date.'],
    ],
    events: [
      ['Intro to 3D Printing', 'Hands-on session: model a simple object and watch it print. No experience needed, machines provided.', 10, 'in_person'],
      ['Repair & Tinker Night', 'Bring a broken gadget. We open it up, diagnose it together, and try to bring it back to life.', 23, 'in_person'],
    ],
  },
  {
    name: 'Community Kitchen',
    categorySlug: 'neighborhood-local',
    join_mode: 'open',
    description:
      'Cook together, eat together, share the surplus. Batch-cook for neighbours in need, swap recipes across cultures, and never let good food go to waste. The recipe is reciprocity.',
    channels: [
      ['general', 'What are you cooking?'],
      ['recipe-swap', 'Share and request recipes'],
      ['surplus-share', 'Offer extras before they spoil'],
    ],
    bulletin: [
      ['Big-batch chili this Sunday — portions to share', 'Making a vat. If you or someone you know could use a few hot meals, message me. No questions, no cost.'],
      ['Trade: my grandmother\'s dumpling recipe', 'I will teach dumplings from scratch if someone teaches me proper sourdough. Generational knowledge for generational knowledge.'],
      ['Surplus: a crate of slightly-too-ripe bananas', 'Banana bread emergency. Come take some or share your best recipe so I can deal with them myself.'],
    ],
    events: [
      ['Community Cook & Share', 'Cook a big batch together, split it into portions, and deliver to neighbours who need a meal. Aprons provided.', 12, 'in_person'],
      ['Recipes From Home Potluck', 'Bring a dish that means something to you and the story behind it. Eat well, learn a little.', 26, 'in_person'],
    ],
  },
  {
    name: 'Founders Roundtable',
    categorySlug: 'professional-career',
    join_mode: 'request',
    description:
      'Early-stage founders trading honest advice, intros, and the occasional reality check. No gurus, no pitching to each other — just people in the trenches helping each other not quit.',
    channels: [
      ['general', 'Wins, losses, and questions'],
      ['intros', 'Ask for and offer warm intros'],
      ['hard-problems', 'Bring the thing keeping you up'],
    ],
    bulletin: [
      ['Can anyone intro me to a fractional CFO?', 'Bootstrapped, finally need real financial modelling. Will happily return the favour — I know a lot of design and growth folks.'],
      ['What I learned shutting down my last startup', 'Three years, gone. Writing the honest post-mortem here in case it saves someone the same mistakes. Ask me anything.'],
      ['Monthly accountability check-in', 'Post your one big goal for the month. We circle back at month-end. Saying it out loud to peers changes everything.'],
    ],
    events: [
      ['Founder Office Hours', 'Round-robin video call: each founder gets ten minutes with the group on their biggest current problem.', 9, 'online'],
      ['Reality-Check Roundtable', 'No-pitch, no-ego discussion of what is actually working and what is not. Bring your real numbers.', 25, 'online'],
    ],
  },
  {
    name: 'Books & Banter',
    categorySlug: 'social-friendship',
    join_mode: 'open',
    description:
      'A book club that is really a friendship club with reading attached. Swap books, argue endings, and meet people who finish the chapter and stay for the conversation.',
    channels: [
      ['general', 'Bookish chatter and hellos'],
      ['current-read', 'Discuss the book of the month'],
      ['book-swap', 'Pass books along the chain'],
    ],
    bulletin: [
      ['This month\'s pick: a quiet stunner', 'We landed on a short literary novel — under 250 pages, so no excuses. Discussion thread opens in #current-read. Spoilers tagged.'],
      ['Free box of paperbacks, mostly mystery', 'Cleaning my shelves. Come grab a stack. The deal is you pass them on when you are done.'],
      ['Unpopular opinion thread', 'A beloved classic that you think is overrated — go. I will start the fire and bring the marshmallows.'],
    ],
    events: [
      ['Monthly Book Club Meetup', 'Discuss this month\'s pick over drinks. Did not finish? Come anyway — we are forgiving.', 13, 'in_person'],
      ['Silent Reading Hour', 'We gather, we read in companionable silence, we get coffee after. Surprisingly lovely.', 17, 'in_person'],
    ],
  },
  {
    name: 'Clothes Swap Circle',
    categorySlug: 'activism-advocacy',
    join_mode: 'open',
    description:
      'Refresh your wardrobe without buying new. Swap clothes, mend together, and keep good fabric out of landfills. Style is a community resource, not a shopping habit.',
    channels: [
      ['general', 'Swap meetups and intros'],
      ['mending-circle', 'Fix it, do not toss it'],
      ['looking-for', 'Post sizes and needs'],
    ],
    bulletin: [
      ['Next swap: bring a bag, leave with a bag', 'House rule — take roughly what you bring. Leftovers go to the shelter donation box. Everyone wins, nobody pays.'],
      ['Learn visible mending with me', 'I will teach sashiko-style patching at the next meetup. Turn a hole into the best part of the garment. Bring something worn.'],
      ['Looking for: warm coats, size L', 'A family that just arrived in the neighbourhood needs winter coats. If you have any to spare, bring them to the swap.'],
    ],
    events: [
      ['Seasonal Clothes Swap', 'Bring clean clothes you no longer wear, take what you love. Mending station on site. Leftovers donated.', 15, 'in_person'],
      ['Mending Circle', 'Bring a torn or worn garment and learn to repair it. Needles, thread, and patient hands provided.', 27, 'in_person'],
    ],
  },
  {
    name: 'Mindful Mornings',
    categorySlug: 'faith-spirituality',
    join_mode: 'open',
    description:
      'A gentle morning gathering for meditation, reflection, and shared intention — across traditions and none. Start the day grounded, together. Quiet is the gift we give each other.',
    channels: [
      ['general', 'Reflections and welcomes'],
      ['daily-intention', 'Share a word for your day'],
      ['practice-tips', 'Trade what helps you sit'],
    ],
    bulletin: [
      ['New: 15-minute morning sit, every weekday', 'Cameras off, just shared silence and a soft bell. Drop in whenever you can. Consistency over perfection.'],
      ['A reading that has stayed with me', 'Sharing a short passage on attention and patience that reframed my week. No tradition required to appreciate it.'],
      ['How do you handle a restless mind?', 'Some mornings I cannot settle at all. What actually helps you when the noise is loud? Genuinely asking the group.'],
    ],
    events: [
      ['Weekday Morning Sit', 'Fifteen minutes of guided then silent meditation to start the day. All experience levels and beliefs welcome.', 2, 'online'],
      ['Sunday Reflection Circle', 'A longer gathering: sit together, then share a thought or intention for the week if you wish.', 6, 'online'],
    ],
  },
  {
    name: 'Bike Kitchen Co-op',
    categorySlug: 'neighborhood-local',
    join_mode: 'open',
    description:
      'A community bike workshop where you fix your own ride with our tools and each other\'s know-how. Learn wrenching, donate a spare part, keep more people rolling.',
    channels: [
      ['general', 'Bike talk and wrench nights'],
      ['parts-bin', 'Need or have a spare part?'],
      ['ride-along', 'Organize group rides'],
    ],
    bulletin: [
      ['Wrench night every Tuesday', 'Bring your bike and your problem. Volunteers help you fix it yourself — that is the whole point. Tools and stands provided, donations welcome.'],
      ['Parts bin overflowing with tubes & cables', 'Cleaned out the stash. Free tubes (700c and 26"), brake cables, and a few used-but-good tyres. First come.'],
      ['Refurb bikes for folks who need one', 'We fix up donated bikes and give them to neighbours without transport. Got a bike gathering dust? Donate it to roll again.'],
    ],
    events: [
      ['Tuesday Wrench Night', 'Open workshop: fix your bike with our tools and volunteer guidance. Beginners especially welcome.', 4, 'in_person'],
      ['Weekend Community Ride', 'Easy-paced group ride for all abilities. We regroup often and nobody gets dropped. Helmets required.', 14, 'in_person'],
    ],
  },
]

// ---- message pools ----------------------------------------------------------
const GENERIC_MSGS = [
  'Just joined — this is exactly what I was hoping existed in the neighbourhood.',
  'Hi all! Happy to be here.',
  'Count me in for the next one.',
  'This is such a great idea, thanks for setting it up.',
  'Anyone going this weekend?',
  'Saving this thread, super useful.',
  'Love how active this group already is.',
  'Glad I am not the only one who needed this.',
  'Reminder to myself to actually show up this time 😅',
  'Sharing this with a friend who would love it.',
  'New here — what is the best way to get involved?',
  'You all are the reason I look forward to my week.',
  'Done and done. See you there.',
  'Thank you, this community is genuinely the best part of my month.',
  'Bumping this — still relevant!',
]

async function main() {
  console.log('→ Loading categories…')
  const { data: cats, error: catErr } = await admin.from('categories').select('id, slug')
  if (catErr) throw catErr
  const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]))

  // ---- existing seed users map ---------------------------------------------
  console.log('→ Checking for existing seed users…')
  const emailToId = {}
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      if (u.email && u.email.endsWith('@' + SEED_DOMAIN)) emailToId[u.email] = u.id
    }
    if (data.users.length < 1000) break
    page++
  }

  // ---- create users ---------------------------------------------------------
  console.log('→ Creating fake users…')
  const userIds = {} // username -> id
  for (const [username, displayName, bio] of PEOPLE) {
    const email = `${username}@${SEED_DOMAIN}`
    let id = emailToId[email]
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: 'Stoke-Seed-' + Math.random().toString(36).slice(2, 12) + '!9',
        email_confirm: true,
        user_metadata: { username, display_name: displayName },
      })
      if (error) {
        console.warn(`   ! ${username}: ${error.message}`)
        continue
      }
      id = data.user.id
      process.stdout.write('+')
    } else {
      process.stdout.write('.')
    }
    userIds[username] = id
    // ensure profile bio set
    await admin.from('profiles').update({ bio }).eq('id', id)
  }
  console.log(`\n   ${Object.keys(userIds).length} users ready.`)

  const allUsernames = Object.keys(userIds)

  // ---- communities ----------------------------------------------------------
  for (const c of COMMUNITIES) {
    const categoryId = catBySlug[c.categorySlug]
    if (!categoryId) {
      console.warn(`   ! Unknown category ${c.categorySlug} for ${c.name}, skipping`)
      continue
    }
    const slug = c.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60)

    // reuse if exists
    let { data: existing } = await admin.from('communities').select('id').eq('slug', slug).maybeSingle()
    let communityId = existing?.id
    const organizerUsername = pick(allUsernames)
    const organizerId = userIds[organizerUsername]

    if (!communityId) {
      const { data, error } = await admin
        .from('communities')
        .insert({
          name: c.name,
          slug,
          description: c.description,
          join_mode: c.join_mode,
          category_id: categoryId,
          owner_id: organizerId,
          is_listed: true,
          created_at: daysAgo(30 + rand(60)),
        })
        .select('id')
        .single()
      if (error) {
        console.warn(`   ! ${c.name}: ${error.message}`)
        continue
      }
      communityId = data.id
      console.log(`✓ ${c.name}  (/${slug})  organizer: ${organizerUsername}`)
    } else {
      console.log(`= ${c.name}  (/${slug})  already exists, reusing`)
    }

    // members: organizer is auto-added by trigger; add 5–14 more
    const memberCount = 5 + rand(10)
    const memberUsernames = sample(
      allUsernames.filter((u) => userIds[u] !== organizerId),
      memberCount
    )
    const memberRows = memberUsernames.map((u) => ({
      community_id: communityId,
      user_id: userIds[u],
      role: Math.random() < 0.15 ? 'moderator' : 'member',
      status: 'active',
      joined_at: daysAgo(rand(45)),
    }))
    if (memberRows.length) {
      await admin.from('community_members').upsert(memberRows, {
        onConflict: 'community_id,user_id',
        ignoreDuplicates: true,
      })
    }
    const activeUsernames = [organizerUsername, ...memberUsernames]

    // channels + messages
    let pos = 0
    for (const [chName, chDesc] of c.channels) {
      const { data: ch, error: chErr } = await admin
        .from('channels')
        .insert({
          community_id: communityId,
          name: chName,
          description: chDesc,
          position: pos++,
          created_by: organizerId,
          created_at: daysAgo(28),
        })
        .select('id')
        .single()
      if (chErr) {
        console.warn(`     ! channel ${chName}: ${chErr.message}`)
        continue
      }
      // 4–9 messages, chronological
      const msgCount = 4 + rand(6)
      const rows = []
      for (let i = 0; i < msgCount; i++) {
        rows.push({
          channel_id: ch.id,
          author_id: userIds[pick(activeUsernames)],
          content: pick(GENERIC_MSGS),
          created_at: daysAgo(20 - Math.floor((i / msgCount) * 20), 12),
        })
      }
      await admin.from('messages').insert(rows)
    }

    // bulletin posts (published)
    for (let i = 0; i < c.bulletin.length; i++) {
      const [title, content] = c.bulletin[i]
      const when = daysAgo(2 + i * 5, 12)
      await admin.from('bulletin_posts').insert({
        community_id: communityId,
        author_id: userIds[pick(activeUsernames)],
        title,
        content,
        status: 'published',
        published_at: when,
        created_at: when,
      })
    }

    // events + RSVPs
    for (const [title, description, inDays, locType] of c.events) {
      const { data: ev, error: evErr } = await admin
        .from('events')
        .insert({
          community_id: communityId,
          created_by: organizerId,
          title,
          description,
          starts_at: daysFromNow(inDays),
          ends_at: daysFromNow(inDays, 20),
          location_type: locType,
          location_online: locType === 'online' ? 'Link shared with attendees' : null,
          location_address: locType === 'in_person' ? 'Community space — address in event chat' : null,
        })
        .select('id')
        .single()
      if (evErr) {
        console.warn(`     ! event ${title}: ${evErr.message}`)
        continue
      }
      const rsvpUsers = sample(activeUsernames, 2 + rand(activeUsernames.length - 2))
      const rsvpRows = rsvpUsers.map((u) => ({
        event_id: ev.id,
        user_id: userIds[u],
        status: pick(['yes', 'yes', 'yes', 'maybe', 'no']),
      }))
      if (rsvpRows.length) {
        await admin.from('event_rsvps').upsert(rsvpRows, {
          onConflict: 'event_id,user_id',
          ignoreDuplicates: true,
        })
      }
    }
  }

  console.log('\n✅ Seed complete.')
}

main().catch((e) => {
  console.error('\n❌ Seed failed:', e)
  process.exit(1)
})
