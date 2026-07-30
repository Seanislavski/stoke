// READ-ONLY. Shape of the Body Doubling Q&A library: what's published, what's
// answered, where the gaps are, and what's sitting in the pipelines.
// Run from repo root:  node scripts/library-shape.mjs
//
// Use this instead of quoting library numbers from notes — they go stale fast.
// Answers the questions that actually change the advice: is there a moderation
// backlog, or is the problem inflow? Which published questions have zero
// answers (a /library hit that delivers nothing)? Which categories are empty?
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
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

const CID = '5310e8c7-1276-485f-b77e-406d7edcf890'

const { data: qs } = await admin
  .from('kb_questions')
  .select('id, title, status, category_id, asker_id, published_at, is_public, created_at')
  .eq('community_id', CID)

const { data: cats } = await admin
  .from('kb_categories')
  .select('id, name, position')
  .eq('community_id', CID)
  .order('position')

const { data: ans } = await admin
  .from('kb_answers')
  .select('id, question_id, status, author_id, is_accepted, attribution')
  .eq('community_id', CID)

const { data: bank } = await admin
  .from('qotw_items')
  .select('id, title, number, planned_for, question_id, position')
  .eq('community_id', CID)
  .order('position')

const { data: caps } = await admin
  .from('discord_captures')
  .select('id, consent_status, question_id, answer_id, claimed_by, dismissed_at, created_at')
  .eq('community_id', CID)

const byStatus = (rows) => rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {})
const catName = (id) => cats.find((c) => c.id === id)?.name ?? '(uncategorised)'

console.log('=== QUESTIONS ===', byStatus(qs), 'total', qs.length)
console.log('=== ANSWERS   ===', byStatus(ans), 'total', ans.length)

const pub = qs.filter((q) => q.status === 'published')
const pubAns = ans.filter((a) => a.status === 'published')
const countFor = (qid) => pubAns.filter((a) => a.question_id === qid).length

console.log('\n=== PUBLISHED QUESTIONS BY CATEGORY ===')
const perCat = {}
for (const q of pub) perCat[catName(q.category_id)] = (perCat[catName(q.category_id)] || 0) + 1
for (const [k, v] of Object.entries(perCat).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)
console.log('  categories with ZERO published questions:',
  cats.filter((c) => !pub.some((q) => q.category_id === c.id)).map((c) => c.name).join(', ') || '(none)')

console.log('\n=== ANSWER COVERAGE (published questions) ===')
const zero = pub.filter((q) => countFor(q.id) === 0)
console.log(`  answered: ${pub.length - zero.length}/${pub.length}   UNANSWERED: ${zero.length}`)
for (const q of zero) console.log(`   [0 answers] ${catName(q.category_id)} :: ${q.title.slice(0, 70)}`)

console.log('\n=== ALL PUBLISHED, newest first ===')
for (const q of [...pub].sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))) {
  console.log(`  ${(q.published_at || '').slice(0, 10)}  ans=${countFor(q.id)}  pub=${q.is_public ? 'Y' : 'n'}  ${catName(q.category_id).slice(0, 22).padEnd(22)}  ${q.title.slice(0, 60)}`)
}

console.log('\n=== QOTW ===')
console.log('  published:', bank.filter((b) => b.number > 0).map((b) => `#${b.number}`).join(' ') || '(none)')
console.log('  undated drafts waiting:', bank.filter((b) => !b.number && !b.planned_for).length)
console.log('  dated drafts:', bank.filter((b) => !b.number && b.planned_for).map((b) => `${b.planned_for}`).join(', ') || '(none)')

console.log('\n=== DISCORD CAPTURES ===', byStatus ? '' : '')
const capBy = caps.reduce((a, c) => ((a[c.consent_status] = (a[c.consent_status] || 0) + 1), a), {})
console.log(' ', capBy, 'total', caps.length)
console.log('  granted + filed:', caps.filter((c) => c.consent_status.startsWith('granted') && (c.question_id || c.answer_id)).length)
console.log('  granted + UNFILED (sitting in review queue):', caps.filter((c) => c.consent_status.startsWith('granted') && !c.question_id && !c.answer_id && !c.dismissed_at).length)
console.log('  pending consent:', caps.filter((c) => c.consent_status === 'pending').length)

console.log('\n=== ATTRIBUTED (Discord-sourced) published answers ===',
  pubAns.filter((a) => a.attribution).length, 'of', pubAns.length)
