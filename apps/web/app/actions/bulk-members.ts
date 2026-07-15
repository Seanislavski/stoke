'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'
import { checkMemberLimit } from '@/lib/billing'

export type BulkRow = { username: string; email: string; password: string }
export type BulkResultStatus = 'created' | 'added' | 'already_member' | 'error'
export type BulkResult = {
  email: string
  username: string
  ok: boolean
  status: BulkResultStatus
  message?: string
}

// Owner, organizer, or platform staff may bulk-add members (mirrors the
// "who can email all members" authority — heavier than everyday moderation).
async function requireOrganizer(communityId: string): Promise<{ userId: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: community }, { data: platformRole }, { data: member }] = await Promise.all([
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
    admin.from('community_members').select('role').eq('community_id', communityId).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ])

  const isOwner = community?.owner_id === user.id
  const isOrganizer = member?.role === 'organizer'
  if (isOwner || platformRole || isOrganizer) return { userId: user.id }
  return null
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function bulkAddMembers(
  communityId: string,
  slug: string,
  rows: BulkRow[]
): Promise<{ error?: string; results?: BulkResult[] }> {
  const caller = await requireOrganizer(communityId)
  if (!caller) return { error: 'Not authorized' }

  const admin = createAdminClient()

  // Build an email -> existing-user-id map once, so we can both detect
  // duplicates and add already-registered people to the community.
  const emailToId = new Map<string, string>()
  {
    let page = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data?.users?.length) break
      for (const u of data.users) if (u.email) emailToId.set(u.email.toLowerCase(), u.id)
      if (data.users.length < 1000) break
      page++
    }
  }

  const results: BulkResult[] = []

  for (const raw of rows) {
    const email = (raw.email || '').trim().toLowerCase()
    const username = (raw.username || '').trim()
    const password = raw.password || ''

    // Skip entirely blank rows (grid pads with empties).
    if (!email && !username) continue

    if (!EMAIL_RE.test(email)) {
      results.push({ email, username, ok: false, status: 'error', message: 'Invalid email address' })
      continue
    }
    if (!username) {
      results.push({ email, username, ok: false, status: 'error', message: 'Username is required' })
      continue
    }

    // Resolve or create the auth user.
    let userId = emailToId.get(email) ?? null
    let created = false

    if (!userId) {
      if (password.length < 6) {
        results.push({ email, username, ok: false, status: 'error', message: 'Password must be at least 6 characters' })
        continue
      }
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, display_name: username },
      })
      if (createErr || !newUser?.user) {
        results.push({ email, username, ok: false, status: 'error', message: createErr?.message ?? 'Could not create account' })
        continue
      }
      userId = newUser.user.id
      created = true
      emailToId.set(email, userId)
    }

    // Add (or reactivate) their membership in this community.
    const { data: existing } = await admin
      .from('community_members')
      .select('id, role, status')
      .eq('community_id', communityId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'banned') {
        results.push({ email, username, ok: false, status: 'error', message: 'This person is banned from the community' })
        continue
      }
      if (existing.status === 'active') {
        results.push({
          email,
          username,
          ok: true,
          status: 'already_member',
          message: created ? 'Account created — was already a member' : 'Already a member',
        })
        continue
      }
      // pending or timed_out -> activate, keep their existing role
      const { error: upErr } = await admin.from('community_members').update({ status: 'active' }).eq('id', existing.id)
      if (upErr) {
        results.push({ email, username, ok: false, status: 'error', message: upErr.message })
        continue
      }
    } else {
      // New membership — respect the owner's plan member cap.
      try {
        await checkMemberLimit(communityId)
      } catch (e) {
        results.push({ email, username, ok: false, status: 'error', message: (e as Error).message })
        continue
      }
      const { error: insErr } = await admin
        .from('community_members')
        .insert({ community_id: communityId, user_id: userId, role: 'member', status: 'active' })
      if (insErr) {
        results.push({ email, username, ok: false, status: 'error', message: insErr.message })
        continue
      }
    }

    logAction({
      actorId: caller.userId,
      communityId,
      action: 'member.added',
      targetUserId: userId,
      metadata: { username, email, created },
    })

    results.push({ email, username, ok: true, status: created ? 'created' : 'added' })
  }

  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)

  return { results }
}
