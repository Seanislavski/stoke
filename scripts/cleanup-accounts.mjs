// Deletes auth users by email (cascade clears their profile + memberships).
// Pass the emails to delete as arguments, then --yes to execute:
//   node scripts/cleanup-accounts.mjs rifarit132@dosbee.com foo@bar.com --yes
// Without --yes it's a dry run. Refuses to delete protected accounts.
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

// Never delete these no matter what is passed in.
const PROTECTED = ['baldwinseana@gmail.com']

async function main() {
  const execute = process.argv.includes('--yes')
  const emails = process.argv.slice(2).filter(a => a.includes('@')).map(e => e.toLowerCase())
  if (!emails.length) { console.log('No emails given. Usage: node scripts/cleanup-accounts.mjs a@b.com c@d.com --yes'); return }

  // map emails → ids
  const idByEmail = {}
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) if (u.email) idByEmail[u.email.toLowerCase()] = u.id
    if (data.users.length < 1000) break
    page++
  }

  for (const email of emails) {
    if (PROTECTED.includes(email)) { console.log(`  ! protected, skipping ${email}`); continue }
    const id = idByEmail[email]
    if (!id) { console.log(`  (not found) ${email}`); continue }
    if (!execute) { console.log(`  would delete: ${email}`); continue }
    const { error } = await admin.auth.admin.deleteUser(id)
    console.log(error ? `  ! ${email}: ${error.message}` : `  - deleted ${email}`)
  }
  console.log(execute ? '\nDone.' : '\nDRY RUN — add --yes to execute.')
}
main().catch(e => { console.error(e); process.exit(1) })
