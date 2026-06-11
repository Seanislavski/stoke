// Seed script: starter Q&A categories + questions for the Body Doubling community.
// All content is authored by the community owner (auto-published). Idempotent:
// re-running skips categories/questions that already exist by name/title.
//
// Run from repo root:  node scripts/seed-bodydoubling-qa.mjs
// Remove later:        node scripts/seed-bodydoubling-qa.mjs --remove

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
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    env[m[1]] = val
  }
  return env
}

const env = loadEnv()
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---- content ----------------------------------------------------------------
const CATEGORIES = [
  ['Getting started', 'New to body doubling or ADHD — start here.'],
  ['Focus techniques', 'What actually helps you start and sustain attention.'],
  ['Tools & apps', 'Timers, blockers, and trackers people swear by.'],
  ['Routines & systems', 'Daily structure and habit scaffolding that holds up.'],
  ['Meds & treatment', 'Peer experiences and logistics — not medical advice.'],
  ['Body doubling setups', 'How people run and get the most from their sessions.'],
]

// [category name, question title, optional body]
const QUESTIONS = [
  ['Tools & apps', 'What timer setup actually works for ADHD?', 'Pomodoro, flowmodoro, visual timers — what has actually stuck for you and why?'],
  ['Focus techniques', 'How do I start when starting feels impossible?', 'The gap between wanting to start and actually starting. What gets you over it?'],
  ['Tools & apps', 'Best apps/extensions for blocking distractions?', 'Looking for what people genuinely keep using past the first week.'],
  ['Body doubling setups', 'How do I run a good body doubling session?', 'Tips for hosting or joining so the time actually stays productive.'],
  ['Focus techniques', 'What do you do when you lose focus mid-session?', 'How do you get back on track without spiraling or giving up for the day?'],
  ['Routines & systems', 'Morning routine ideas that survive ADHD?', 'Routines that hold up on the hard days, not just the good ones.'],
]

async function main() {
  const { data: community, error: cErr } = await admin
    .from('communities').select('id, owner_id, name').eq('slug', SLUG).single()
  if (cErr || !community) { console.error(`Community "${SLUG}" not found.`, cErr?.message ?? ''); process.exit(1) }
  console.log(`Target: ${community.name} (${community.id})`)

  if (REMOVE) {
    const titles = QUESTIONS.map(q => q[1])
    const names = CATEGORIES.map(c => c[0])
    const { count: qDel } = await admin.from('kb_questions').delete({ count: 'exact' })
      .eq('community_id', community.id).in('title', titles)
    const { count: cDel } = await admin.from('kb_categories').delete({ count: 'exact' })
      .eq('community_id', community.id).in('name', names)
    console.log(`Removed ${qDel ?? 0} questions and ${cDel ?? 0} categories.`)
    return
  }

  // Categories (idempotent by name)
  const { data: existingCats } = await admin.from('kb_categories')
    .select('id, name').eq('community_id', community.id)
  const catId = {}
  for (const c of existingCats ?? []) catId[c.name] = c.id

  let position = (existingCats ?? []).length
  for (const [name, description] of CATEGORIES) {
    if (catId[name]) { console.log(`  category exists: ${name}`); continue }
    const { data, error } = await admin.from('kb_categories').insert({
      community_id: community.id, name, description, position: position++, created_by: community.owner_id,
    }).select('id').single()
    if (error) { console.error(`  category failed: ${name} — ${error.message}`); continue }
    catId[name] = data.id
    console.log(`  + category: ${name}`)
  }

  // Questions (idempotent by title), auto-published, authored by owner
  const { data: existingQs } = await admin.from('kb_questions')
    .select('title').eq('community_id', community.id)
  const haveTitle = new Set((existingQs ?? []).map(q => q.title))
  const now = new Date().toISOString()

  for (const [catName, title, body] of QUESTIONS) {
    if (haveTitle.has(title)) { console.log(`  question exists: ${title}`); continue }
    const { error } = await admin.from('kb_questions').insert({
      community_id: community.id,
      category_id: catId[catName] ?? null,
      asker_id: community.owner_id,
      title,
      body: body ?? null,
      status: 'published',
      approved_by: community.owner_id,
      published_at: now,
    })
    if (error) { console.error(`  question failed: ${title} — ${error.message}`); continue }
    console.log(`  + question: ${title}`)
  }

  console.log('Done.')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
