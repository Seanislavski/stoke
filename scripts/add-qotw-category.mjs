// Creates the "Question of the Week" Q&A category for the Body Doubling community.
// This is the switch that activates the Question of the Week feature (spotlight card
// + public shareable question view). Idempotent — re-running is a no-op if it exists.
//
// Run from repo root:  node scripts/add-qotw-category.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SLUG = 'bodydoublingcom'
const NAME = 'Question of the Week'
const DESCRIPTION = "This week's question — add your answer."

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

async function main() {
  const { data: community, error: cErr } = await admin
    .from('communities').select('id, owner_id, name').eq('slug', SLUG).single()
  if (cErr || !community) { console.error(`Community "${SLUG}" not found.`, cErr?.message ?? ''); process.exit(1) }
  console.log(`Target: ${community.name} (${community.id})`)

  const { data: existing } = await admin.from('kb_categories')
    .select('id, name').eq('community_id', community.id)
  if ((existing ?? []).some(c => c.name.trim().toLowerCase() === NAME.toLowerCase())) {
    console.log(`  category already exists: ${NAME} — nothing to do.`)
    return
  }

  const position = (existing ?? []).length
  const { data, error } = await admin.from('kb_categories').insert({
    community_id: community.id, name: NAME, description: DESCRIPTION, position, created_by: community.owner_id,
  }).select('id').single()
  if (error) { console.error(`  failed: ${error.message}`); process.exit(1) }
  console.log(`  + category: ${NAME} (${data.id})`)
  console.log('Done. The feature stays dormant until a question is posted into this category.')
}

main().catch(e => { console.error(e); process.exit(1) })
