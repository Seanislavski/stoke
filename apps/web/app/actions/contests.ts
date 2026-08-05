'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logAction, logPhotos } from '@/lib/audit'
import { sendEmail, contestEntrySubmittedHtml, contestWinnerHtml } from '@/lib/email'
import { canTransition, submissionsOpen, type ContestStatus } from '@/lib/contests'

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getAccess(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, membership: null, isMod: false }

  const admin = createAdminClient()
  const [{ data: membership }, { data: community }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])

  const isMod =
    community?.owner_id === user.id ||
    !!platformRole ||
    (membership?.status === 'active' && ['organizer', 'moderator'].includes(membership.role))

  return { user, membership, isMod }
}

async function modEmails(communityId: string) {
  const admin = createAdminClient()
  const [{ data: community }, { data: mods }] = await Promise.all([
    admin.from('communities').select('owner_id, name, slug').eq('id', communityId).single(),
    admin.from('community_members').select('user_id').eq('community_id', communityId).eq('status', 'active').in('role', ['organizer', 'moderator']),
  ])
  if (!community) return { community: null, emails: [] as string[] }
  const ids = new Set<string>([community.owner_id, ...(mods ?? []).map(m => m.user_id)])
  const emails: string[] = []
  for (const id of ids) {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data.user?.email) emails.push(data.user.email)
  }
  return { community, emails }
}

async function emailFor(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}

/** Loads a contest plus the caller's authority over it in one hop. */
async function loadContest(contestId: string) {
  const admin = createAdminClient()
  const { data: contest } = await admin
    .from('contests')
    .select('id, community_id, title, status, submissions_close_at, voting_close_at, max_entries_per_member, winner_entry_id')
    .eq('id', contestId)
    .single()
  if (!contest) return { contest: null, access: null, slug: null }

  const { data: community } = await admin.from('communities').select('slug').eq('id', contest.community_id).single()
  const access = await getAccess(contest.community_id)
  return { contest, access, slug: community?.slug ?? null }
}

function revalidateContest(slug: string | null, contestId: string) {
  if (!slug) return
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/contests/${contestId}`)
  revalidatePath(`/communities/${slug}/moderation`)
}

// ─── contest lifecycle (mods) ─────────────────────────────────────────────────

const DEFAULT_TERMS =
  'By entering, I confirm this design is my own original work and I grant the ' +
  'community organizers permission to reproduce, adapt and sell it on merchandise, ' +
  'with credit. I keep ownership of my design.'

export async function createContest(communityId: string, slug: string, formData: FormData) {
  const { user, isMod } = await getAccess(communityId)
  if (!user || !isMod) return { error: 'Not authorized.' }

  const title = (formData.get('title') as string ?? '').trim()
  if (!title) return { error: 'Title is required.' }

  const description = (formData.get('description') as string ?? '').trim() || null
  const rules = (formData.get('rules') as string ?? '').trim() || null
  const terms = (formData.get('terms') as string ?? '').trim() || DEFAULT_TERMS
  const submissions_close_at = (formData.get('submissions_close_at') as string) || null
  const voting_close_at = (formData.get('voting_close_at') as string) || null
  const maxRaw = parseInt((formData.get('max_entries_per_member') as string) ?? '1', 10)
  const max_entries_per_member = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 1

  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('contests')
    .insert({
      community_id: communityId, title, description, rules, terms,
      submissions_close_at, voting_close_at, max_entries_per_member,
      created_by: user.id, status: 'draft',
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: 'Could not create the contest.' }

  logAction({ actorId: user.id, communityId, action: 'contest.created', targetId: inserted.id, targetType: 'contest' })
  revalidateContest(slug, inserted.id)
  return { ok: true, contestId: inserted.id }
}

export async function updateContest(contestId: string, formData: FormData) {
  const { contest, access, slug } = await loadContest(contestId)
  if (!contest || !access?.user || !access.isMod) return { error: 'Not authorized.' }

  const title = (formData.get('title') as string ?? '').trim()
  if (!title) return { error: 'Title is required.' }

  const maxRaw = parseInt((formData.get('max_entries_per_member') as string) ?? '1', 10)

  const admin = createAdminClient()
  const { error } = await admin
    .from('contests')
    .update({
      title,
      description: (formData.get('description') as string ?? '').trim() || null,
      rules: (formData.get('rules') as string ?? '').trim() || null,
      terms: (formData.get('terms') as string ?? '').trim() || DEFAULT_TERMS,
      submissions_close_at: (formData.get('submissions_close_at') as string) || null,
      voting_close_at: (formData.get('voting_close_at') as string) || null,
      max_entries_per_member: Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contestId)

  if (error) return { error: 'Could not save the contest.' }

  logAction({ actorId: access.user.id, communityId: contest.community_id, action: 'contest.edited', targetId: contestId, targetType: 'contest' })
  revalidateContest(slug, contestId)
  return { ok: true }
}

export async function setContestStatus(contestId: string, status: ContestStatus) {
  const { contest, access, slug } = await loadContest(contestId)
  if (!contest || !access?.user || !access.isMod) return { error: 'Not authorized.' }

  if (!canTransition(contest.status as ContestStatus, status)) {
    return { error: `Can’t move a contest from ${contest.status} to ${status}.` }
  }

  // Opening voting with no finalists would show members an empty ballot.
  if (status === 'voting') {
    const admin = createAdminClient()
    const { count } = await admin
      .from('contest_entries')
      .select('id', { count: 'exact', head: true })
      .eq('contest_id', contestId).eq('status', 'approved').eq('is_finalist', true)
    if (!count) return { error: 'Mark at least one finalist before opening voting.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('contests')
    .update({
      status,
      updated_at: new Date().toISOString(),
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', contestId)

  if (error) return { error: 'Could not change the contest phase.' }

  logAction({
    actorId: access.user.id, communityId: contest.community_id,
    action: 'contest.status_changed', targetId: contestId, targetType: 'contest',
    metadata: { before: contest.status, after: status },
  })
  revalidateContest(slug, contestId)
  return { ok: true }
}

export async function deleteContest(contestId: string) {
  const { contest, access, slug } = await loadContest(contestId)
  if (!contest || !access?.user || !access.isMod) return { error: 'Not authorized.' }

  const admin = createAdminClient()
  // Gather entry photos before the cascade removes the rows.
  const { data: entries } = await admin.from('contest_entries').select('id, photos').eq('contest_id', contestId)
  const photos = (entries ?? []).flatMap(e => e.photos ?? [])

  const { error } = await admin.from('contests').delete().eq('id', contestId)
  if (error) return { error: 'Could not delete the contest.' }

  logAction({ actorId: access.user.id, communityId: contest.community_id, action: 'contest.deleted', targetId: contestId, targetType: 'contest' })
  if (photos.length) logPhotos({ actorId: access.user.id, communityId: contest.community_id, removed: photos, source: 'contest', parentId: contestId })
  revalidateContest(slug, contestId)
  return { ok: true }
}

// ─── entries (members) ────────────────────────────────────────────────────────

export async function submitEntry(contestId: string, formData: FormData) {
  const { contest, access, slug } = await loadContest(contestId)
  if (!contest || !access?.user) return { error: 'Not logged in.' }

  const isActiveMember = access.membership?.status === 'active'
  if (!isActiveMember && !access.isMod) return { error: 'Only members can enter this contest.' }

  if (!submissionsOpen(contest)) return { error: 'Entries are closed for this contest.' }

  // The licence grant is the entire legal basis for printing a winning design,
  // so an entry cannot be created without it.
  if (formData.get('agree_terms') !== 'on') {
    return { error: 'You need to agree to the entry terms before submitting.' }
  }

  const title = (formData.get('title') as string ?? '').trim()
  if (!title) return { error: 'Give your entry a title.' }

  const photosRaw = formData.get('photos') as string | null
  const photos: string[] = photosRaw ? JSON.parse(photosRaw) : []
  if (!photos.length) return { error: 'Add at least one image of your design.' }

  const admin = createAdminClient()
  const { count: mine } = await admin
    .from('contest_entries')
    .select('id', { count: 'exact', head: true })
    .eq('contest_id', contestId).eq('author_id', access.user.id).neq('status', 'rejected')

  if ((mine ?? 0) >= contest.max_entries_per_member) {
    return { error: `You can enter at most ${contest.max_entries_per_member} design${contest.max_entries_per_member === 1 ? '' : 's'} in this contest.` }
  }

  const { data: inserted, error } = await admin
    .from('contest_entries')
    .insert({
      contest_id: contestId,
      community_id: contest.community_id,
      author_id: access.user.id,
      title,
      description: (formData.get('description') as string ?? '').trim() || null,
      photos,
      status: 'pending',
      terms_agreed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: 'Could not submit your entry.' }

  logAction({ actorId: access.user.id, communityId: contest.community_id, action: 'entry.submitted', targetId: inserted.id, targetType: 'entry', metadata: { contest_id: contestId } })
  logPhotos({ actorId: access.user.id, communityId: contest.community_id, added: photos, source: 'contest', parentId: inserted.id })

  void (async () => {
    const { community: c, emails } = await modEmails(contest.community_id)
    if (!c) return
    for (const to of emails) {
      await sendEmail(to, `New contest entry awaiting review in ${c.name}`, contestEntrySubmittedHtml(c.name, c.slug, contest.title, title))
    }
  })()

  revalidateContest(slug, contestId)
  return { ok: true }
}

export async function editEntry(entryId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const admin = createAdminClient()
  const { data: entry } = await admin
    .from('contest_entries')
    .select('id, contest_id, community_id, author_id, status, photos')
    .eq('id', entryId)
    .single()
  if (!entry) return { error: 'Entry not found.' }

  const { contest, access, slug } = await loadContest(entry.contest_id)
  if (!contest || !access) return { error: 'Contest not found.' }

  const isAuthor = entry.author_id === user.id
  if (!isAuthor && !access.isMod) return { error: 'Not authorized.' }
  if (isAuthor && !access.isMod && !submissionsOpen(contest)) {
    return { error: 'Entries can no longer be edited for this contest.' }
  }

  const title = (formData.get('title') as string ?? '').trim()
  if (!title) return { error: 'Give your entry a title.' }

  const photosRaw = formData.get('photos') as string | null
  const photos: string[] = photosRaw ? JSON.parse(photosRaw) : []
  if (!photos.length) return { error: 'Add at least one image of your design.' }

  // Same rule as Q&A: an author reworking an already-approved entry sends it
  // back for review. A mod editing leaves it where it is.
  const requeue = !access.isMod && entry.status === 'approved'

  const { error } = await admin
    .from('contest_entries')
    .update({
      title,
      description: (formData.get('description') as string ?? '').trim() || null,
      photos,
      updated_at: new Date().toISOString(),
      ...(requeue ? { status: 'pending', is_finalist: false, approved_by: null } : {}),
    })
    .eq('id', entryId)

  if (error) return { error: 'Could not save your entry.' }

  logAction({ actorId: user.id, communityId: entry.community_id, action: 'entry.edited', targetId: entryId, targetType: 'entry', metadata: { contest_id: entry.contest_id, requeued: requeue } })

  const before: string[] = entry.photos ?? []
  const added = photos.filter(p => !before.includes(p))
  const removed = before.filter(p => !photos.includes(p))
  if (added.length || removed.length) {
    logPhotos({ actorId: user.id, communityId: entry.community_id, added, removed, source: 'contest', parentId: entryId })
  }

  revalidateContest(slug, entry.contest_id)
  return { ok: true, requeued: requeue }
}

export async function deleteEntry(entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in.' }

  const admin = createAdminClient()
  const { data: entry } = await admin
    .from('contest_entries')
    .select('id, contest_id, community_id, author_id, photos')
    .eq('id', entryId)
    .single()
  if (!entry) return { error: 'Entry not found.' }

  const access = await getAccess(entry.community_id)
  const isAuthor = entry.author_id === user.id
  if (!isAuthor && !access.isMod) return { error: 'Not authorized.' }

  const { data: community } = await admin.from('communities').select('slug').eq('id', entry.community_id).single()

  const { error } = await admin.from('contest_entries').delete().eq('id', entryId)
  if (error) return { error: 'Could not delete the entry.' }

  logAction({ actorId: user.id, communityId: entry.community_id, action: 'entry.deleted', targetId: entryId, targetType: 'entry', metadata: { contest_id: entry.contest_id, self: isAuthor } })
  if (entry.photos?.length) logPhotos({ actorId: user.id, communityId: entry.community_id, removed: entry.photos, source: 'contest', parentId: entryId })

  revalidateContest(community?.slug ?? null, entry.contest_id)
  return { ok: true }
}

// ─── entry moderation ─────────────────────────────────────────────────────────

async function setEntryStatus(entryId: string, status: 'approved' | 'rejected') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: entry } = await admin
    .from('contest_entries')
    .select('id, contest_id, community_id')
    .eq('id', entryId)
    .single()
  if (!entry) return { error: 'Entry not found.' }

  const access = await getAccess(entry.community_id)
  if (!access.isMod) return { error: 'Not authorized.' }

  const { error } = await admin
    .from('contest_entries')
    .update({
      status,
      approved_by: status === 'approved' ? user.id : null,
      ...(status === 'rejected' ? { is_finalist: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)

  if (error) return { error: 'Could not update the entry.' }

  const { data: community } = await admin.from('communities').select('slug').eq('id', entry.community_id).single()
  logAction({ actorId: user.id, communityId: entry.community_id, action: `entry.${status}`, targetId: entryId, targetType: 'entry', metadata: { contest_id: entry.contest_id } })
  revalidateContest(community?.slug ?? null, entry.contest_id)
  return { ok: true }
}

export async function approveEntry(entryId: string) {
  return setEntryStatus(entryId, 'approved')
}

export async function rejectEntry(entryId: string) {
  return setEntryStatus(entryId, 'rejected')
}

export async function toggleFinalist(entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: entry } = await admin
    .from('contest_entries')
    .select('id, contest_id, community_id, status, is_finalist')
    .eq('id', entryId)
    .single()
  if (!entry) return { error: 'Entry not found.' }

  const access = await getAccess(entry.community_id)
  if (!access.isMod) return { error: 'Not authorized.' }
  if (entry.status !== 'approved') return { error: 'Approve the entry before making it a finalist.' }

  const next = !entry.is_finalist
  const { error } = await admin
    .from('contest_entries')
    .update({ is_finalist: next, updated_at: new Date().toISOString() })
    .eq('id', entryId)

  if (error) return { error: 'Could not update the finalist list.' }

  const { data: community } = await admin.from('communities').select('slug').eq('id', entry.community_id).single()
  logAction({ actorId: user.id, communityId: entry.community_id, action: 'entry.finalist_changed', targetId: entryId, targetType: 'entry', metadata: { contest_id: entry.contest_id, is_finalist: next } })
  revalidateContest(community?.slug ?? null, entry.contest_id)
  return { ok: true, is_finalist: next }
}

// ─── voting ───────────────────────────────────────────────────────────────────

export async function castVote(contestId: string, entryId: string) {
  const { contest, access, slug } = await loadContest(contestId)
  if (!contest || !access?.user) return { error: 'Not logged in.' }

  if (access.membership?.status !== 'active') return { error: 'Only members can vote in this contest.' }
  if (contest.status !== 'voting') return { error: 'Voting isn’t open for this contest.' }

  const admin = createAdminClient()
  const { data: entry } = await admin
    .from('contest_entries')
    .select('id, status, is_finalist')
    .eq('id', entryId).eq('contest_id', contestId)
    .single()
  if (!entry || entry.status !== 'approved' || !entry.is_finalist) {
    return { error: 'That entry isn’t in the running.' }
  }

  // The (contest_id, voter_id) primary key is what enforces one vote each, so
  // changing your mind is an upsert rather than a second row.
  const { error } = await admin
    .from('contest_votes')
    .upsert(
      { contest_id: contestId, entry_id: entryId, voter_id: access.user.id },
      { onConflict: 'contest_id,voter_id' },
    )

  if (error) return { error: 'Could not record your vote.' }

  revalidateContest(slug, contestId)
  return { ok: true }
}

export async function setWinner(contestId: string, entryId: string | null) {
  const { contest, access, slug } = await loadContest(contestId)
  if (!contest || !access?.user || !access.isMod) return { error: 'Not authorized.' }

  const admin = createAdminClient()

  let winner: { id: string; title: string; author_id: string } | null = null
  if (entryId) {
    const { data } = await admin
      .from('contest_entries')
      .select('id, title, author_id')
      .eq('id', entryId).eq('contest_id', contestId)
      .single()
    if (!data) return { error: 'That entry isn’t part of this contest.' }
    winner = data
  }

  const { error } = await admin
    .from('contests')
    .update({ winner_entry_id: entryId, updated_at: new Date().toISOString() })
    .eq('id', contestId)

  if (error) return { error: 'Could not set the winner.' }

  logAction({ actorId: access.user.id, communityId: contest.community_id, action: 'contest.winner_set', targetId: contestId, targetType: 'contest', metadata: { entry_id: entryId } })

  if (winner && winner.author_id !== access.user.id) {
    const w = winner
    void (async () => {
      const [to, { data: c }] = await Promise.all([
        emailFor(w.author_id),
        admin.from('communities').select('name, slug').eq('id', contest.community_id).single(),
      ])
      if (to && c) {
        await sendEmail(to, `Your entry won ${contest.title}!`, contestWinnerHtml(c.name, c.slug, contestId, contest.title, w.title))
      }
    })()

    // message_id doubles as the generic target id here, the same way the qotw
    // notification stores a question id in it.
    void admin.from('notifications').insert({
      user_id: w.author_id,
      type: 'contest_winner',
      actor_id: access.user.id,
      community_id: contest.community_id,
      message_id: contestId,
    })
  }

  revalidateContest(slug, contestId)
  return { ok: true }
}

// ─── settings ─────────────────────────────────────────────────────────────────

export async function setContestsEnabled(communityId: string, slug: string, enabled: boolean) {
  const { user, isMod } = await getAccess(communityId)
  if (!user || !isMod) return { error: 'Not authorized.' }

  const admin = createAdminClient()
  const { error } = await admin.from('communities').update({ has_contests: enabled }).eq('id', communityId)
  if (error) return { error: 'Could not update the setting.' }

  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/settings`)
  return { ok: true }
}
