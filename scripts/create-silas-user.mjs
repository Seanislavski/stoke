// Creates the Silas! system user on Stoke (Phase 0 of the Discord capture pipeline):
//   - auth user silas@stoke.community (confirmed, random password — never logged in)
//   - profile: username `silas`, display "Silas!", librarian bio
//   - active `member` row in the Body Doubling community
// Idempotent: safe to re-run; finds the existing user by email and fills gaps.
//
// Run from repo root:  node scripts/create-silas-user.mjs

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const EMAIL = 'silas@stoke.community'
const USERNAME = 'silas'
const DISPLAY = 'Silas!'
const BIO = 'Resident librarian. I archive great advice from the community — always with permission.'
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

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  return data.users.find(u => (u.email ?? '').toLowerCase() === email) ?? null
}

async function main() {
  // 1. Auth user (handle_new_user trigger auto-creates the profile from metadata)
  let user = await findUserByEmail(EMAIL)
  if (user) {
    console.log(`Auth user exists: ${user.id}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: randomBytes(24).toString('base64url'), // never used — system account
      email_confirm: true,
      user_metadata: { username: USERNAME, display_name: DISPLAY },
    })
    if (error) { console.error('createUser failed:', error.message); process.exit(1) }
    user = data.user
    console.log(`Created auth user: ${user.id}`)
  }

  // 2. Profile (trigger created it; ensure fields are right either way)
  const { error: pErr } = await admin.from('profiles')
    .update({ username: USERNAME, display_name: DISPLAY, bio: BIO })
    .eq('id', user.id)
  if (pErr) { console.error('profile update failed:', pErr.message); process.exit(1) }
  console.log(`Profile ok: @${USERNAME} ("${DISPLAY}")`)

  // 3. Active member of Body Doubling
  const { data: community, error: cErr } = await admin
    .from('communities').select('id, name').eq('slug', SLUG).single()
  if (cErr || !community) { console.error(`Community "${SLUG}" not found.`, cErr?.message ?? ''); process.exit(1) }

  const { data: existing } = await admin.from('community_members')
    .select('role, status').eq('community_id', community.id).eq('user_id', user.id).maybeSingle()
  if (existing) {
    if (existing.status !== 'active') {
      await admin.from('community_members')
        .update({ status: 'active' })
        .eq('community_id', community.id).eq('user_id', user.id)
      console.log(`Membership reactivated in ${community.name}`)
    } else {
      console.log(`Already an active ${existing.role} in ${community.name}`)
    }
  } else {
    const { error: mErr } = await admin.from('community_members')
      .insert({ community_id: community.id, user_id: user.id, role: 'member', status: 'active' })
    if (mErr) { console.error('membership insert failed:', mErr.message); process.exit(1) }
    console.log(`Added as member of ${community.name}`)
  }

  console.log('')
  console.log(`SILAS_USER_ID=${user.id}`)
  console.log('Record this UUID in CLAUDE.md — capture filing will author content as this user.')
}

main().catch(e => { console.error(e); process.exit(1) })
