// Read-only inventory of communities + users. Helps decide what to clean before launch.
// Run from repo root:  node scripts/inventory.mjs
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
const SEED_DOMAIN = 'seed.stoke.community'

async function main() {
  // all users → id->email map + seed flag
  const idToEmail = {}
  const realUsers = []
  let seedUsers = 0, totalUsers = 0, page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) {
      idToEmail[u.id] = u.email || '(no email)'
      totalUsers++
      if (u.email && u.email.endsWith('@' + SEED_DOMAIN)) seedUsers++
      else realUsers.push(u)
    }
    if (data.users.length < 1000) break
    page++
  }

  const { data: comms } = await admin
    .from('communities')
    .select('id, name, slug, is_listed, owner_id, created_at')
    .order('created_at', { ascending: true })

  console.log(`\nUSERS: ${totalUsers} total · ${seedUsers} seed (@${SEED_DOMAIN}) · ${totalUsers - seedUsers} real\n`)
  console.log(`COMMUNITIES: ${comms?.length ?? 0}\n`)
  for (const c of comms ?? []) {
    const { count } = await admin.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', c.id).eq('status', 'active')
    const ownerEmail = idToEmail[c.owner_id] ?? '(unknown owner)'
    const isSeed = ownerEmail.endsWith('@' + SEED_DOMAIN)
    console.log(`  ${isSeed ? '[SEED]' : '[REAL]'} ${c.name}  (/${c.slug})  listed=${c.is_listed}  members=${count}  owner=${ownerEmail}`)
  }

  console.log(`\nNON-SEED USERS (${realUsers.length}):\n`)
  for (const u of realUsers) {
    const owns = (comms ?? []).filter(c => c.owner_id === u.id).map(c => c.name)
    const { count: reviewN } = await admin.from('reviews').select('*', { count: 'exact', head: true }).eq('author_id', u.id)
    console.log(`  ${u.email}  created=${u.created_at?.slice(0,10)}  owns=[${owns.join(', ') || '—'}]  reviews=${reviewN ?? 0}`)
  }
  console.log('')
}
main().catch(e => { console.error(e); process.exit(1) })
