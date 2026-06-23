// Deletes specific hand-made test communities by slug (FK cascade clears their
// channels/messages/members/bulletin/events/rsvps/reviews/invites/kb).
// BodyDoubling.com is intentionally NOT in the list. Run from repo root:
//   node scripts/cleanup-test-communities.mjs --yes
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
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

// Explicit allow-list of slugs to delete. KEEP bodydoublingcom OUT of this list.
const SLUGS = [
  'dracula-fans',
  'dorky-platypus-lovers',
  'moms-art-group',
  'stonington-lobsta-party',
  'intrepid-design-gurus',
]

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log('DRY RUN — would delete these communities (pass --yes to execute):')
  }
  for (const slug of SLUGS) {
    const { data: c } = await admin.from('communities').select('id, name').eq('slug', slug).maybeSingle()
    if (!c) { console.log(`  (not found) /${slug}`); continue }
    if (c.name.toLowerCase().includes('bodydoubling')) { console.log(`  ! refusing to delete ${c.name}`); continue }
    if (!process.argv.includes('--yes')) { console.log(`  would delete: ${c.name} (/${slug})`); continue }
    const { error } = await admin.from('communities').delete().eq('id', c.id)
    console.log(error ? `  ! ${c.name}: ${error.message}` : `  - deleted ${c.name} (/${slug})`)
  }
  console.log('\nDone.')
}
main().catch(e => { console.error(e); process.exit(1) })
