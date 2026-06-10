// Cleanup script: remove everything created by seed-communities.mjs.
// Deletes seed-owned communities first (FK cascade clears channels, messages,
// members, bulletin posts, events, RSVPs), then deletes the fake auth users
// (cascade clears their profiles). Run before going live.
//
// Run from repo root:  node scripts/unseed-communities.mjs
//   add --yes to skip the confirmation prompt.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

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
const SEED_DOMAIN = 'seed.stoke.community'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // gather seed users
  const seedUsers = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      if (u.email && u.email.endsWith('@' + SEED_DOMAIN)) seedUsers.push(u)
    }
    if (data.users.length < 1000) break
    page++
  }
  const seedIds = seedUsers.map((u) => u.id)

  // communities owned by seed users
  let communities = []
  if (seedIds.length) {
    const { data, error } = await admin
      .from('communities')
      .select('id, name, slug')
      .in('owner_id', seedIds)
    if (error) throw error
    communities = data ?? []
  }

  console.log(`Found ${seedUsers.length} seed users and ${communities.length} seed communities.`)
  if (!seedUsers.length && !communities.length) {
    console.log('Nothing to clean up.')
    return
  }

  if (!process.argv.includes('--yes')) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const ans = await rl.question('Delete all of the above? Type "delete" to confirm: ')
    rl.close()
    if (ans.trim().toLowerCase() !== 'delete') {
      console.log('Aborted.')
      return
    }
  }

  // 1) delete communities (cascades channels/messages/members/bulletin/events/rsvps)
  for (const c of communities) {
    const { error } = await admin.from('communities').delete().eq('id', c.id)
    if (error) console.warn(`  ! ${c.name}: ${error.message}`)
    else console.log(`  - deleted community ${c.name} (/${c.slug})`)
  }

  // 2) delete auth users (cascades profiles + any remaining membership rows)
  let deleted = 0
  for (const u of seedUsers) {
    const { error } = await admin.auth.admin.deleteUser(u.id)
    if (error) console.warn(`  ! ${u.email}: ${error.message}`)
    else deleted++
  }
  console.log(`  - deleted ${deleted} seed users`)

  console.log('\n✅ Cleanup complete.')
}

main().catch((e) => {
  console.error('\n❌ Cleanup failed:', e)
  process.exit(1)
})
