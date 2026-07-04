// Seeds the Question of the Week BANK (drafts only — private to mods, nothing published)
// for the Body Doubling community, using the 24 curated questions from
// Question-of-the-Week-BodyDoubling.pdf. Idempotent by title. Never assigns a number.
//
// Run from repo root:  node scripts/seed-bodydoubling-qotw-bank.mjs
// Remove drafts again:  node scripts/seed-bodydoubling-qotw-bank.mjs --remove

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REMOVE = process.argv.includes('--remove')
const SLUG = 'bodydoublingcom'

function loadEnv() {
  const raw = readFileSync(join(ROOT, 'apps', 'web', '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[m[1]] = v
  }
  return env
}

const env = loadEnv()
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const QUESTIONS = [
  "What's one task you've been avoiding — and what's the smallest possible first step on it?",
  'Are you a morning, afternoon, or late-night brain? Have you tried leaning into it instead of fighting it?',
  'What does your ideal focus setup look like — music or silence, tidy or cluttered, alone or with others?',
  'What kind of task are you most hoping to body double for this week?',
  `What's a "weird" trick that actually works for you, even if it makes no sense to anyone else?`,
  "What's something people misunderstand about how your brain works?",
  `What's a task your brain treats as "impossible" that's objectively tiny?`,
  "What's your relationship with to-do lists: lifeline, guilt-pile, or somewhere in between?",
  "If your brain were a browser, how many tabs are open right now — and which one is playing music you can't find?",
  'When did you first realize body doubling actually worked for you?',
  'Silent co-working or chatty co-working — which one gets you moving, and why?',
  'Timer or body double: which helps you start more often?',
  "What's one thing you'd love an accountability partner for this month?",
  "What's one app, tool, or system that actually stuck — and how many did you try before it?",
  'Paper or digital for capturing thoughts? Defend your choice.',
  "What's your go-to way to catch a thought in the moment so it doesn't vanish forever?",
  "What's a small change to your space or routine that made a bigger difference than you expected?",
  "What's a small win from this week you're proud of? (No win is too small — that's the rule.)",
  'What are you working toward right now, big or small?',
  "What's your current hyperfocus or rabbit hole?",
  "What's fueling your focus today — coffee, tea, water, chaos?",
  'What helps you get back on track after focus slips away?',
  "What's something you're learning to stop being hard on yourself about?",
  `What's one thing you want to move from your "someday" list into "this month"?`,
]

async function main() {
  const { data: community, error: cErr } = await admin
    .from('communities').select('id, owner_id, name').eq('slug', SLUG).single()
  if (cErr || !community) { console.error(`Community "${SLUG}" not found.`, cErr?.message ?? ''); process.exit(1) }
  console.log(`Target: ${community.name} (${community.id})`)

  if (REMOVE) {
    // Only remove unpublished drafts (number is null) matching these titles — never a published QotW.
    const { count } = await admin.from('qotw_items').delete({ count: 'exact' })
      .eq('community_id', community.id).is('number', null).in('title', QUESTIONS)
    console.log(`Removed ${count ?? 0} draft(s).`)
    return
  }

  const { data: existing } = await admin.from('qotw_items')
    .select('title, position').eq('community_id', community.id)
  const haveTitle = new Set((existing ?? []).map(r => r.title))
  let position = (existing ?? []).reduce((mx, r) => Math.max(mx, r.position ?? 0), -1) + 1

  let added = 0
  for (const title of QUESTIONS) {
    if (haveTitle.has(title)) { console.log(`  exists: ${title.slice(0, 50)}…`); continue }
    const { error } = await admin.from('qotw_items').insert({
      community_id: community.id, title, position: position++, created_by: community.owner_id,
    })
    if (error) { console.error(`  failed: ${title.slice(0, 40)} — ${error.message}`); continue }
    added++
    console.log(`  + ${title.slice(0, 50)}…`)
  }
  console.log(`Done. Added ${added} draft(s) to the bank (all private, none published).`)
}

main().catch(e => { console.error(e); process.exit(1) })
