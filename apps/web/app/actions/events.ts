'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction, logPhotos } from '@/lib/audit'
import { wallTimeToUtcIso, isValidTimeZone, DEFAULT_TZ } from '@/lib/eventTime'
import { generateForSeries, advanceWall, type Frequency, type EndType, type SeriesRow } from '@/lib/eventSeries'
import { sendEmail, eventChangedHtml } from '@/lib/email'

type Admin = ReturnType<typeof createAdminClient>

// RSVP statuses that mean "expect me" — the ones told about changes and reminded.
// Stored values are 'yes' | 'maybe' | 'no' (see RsvpButton).
const ATTENDING = ['yes', 'maybe']

// The zone the form's wall-clock times are in: the picker's value if it is a
// real zone, else the user's profile zone, else ET.
async function resolveFormTz(admin: Admin, userId: string, formData: FormData): Promise<string> {
  const picked = formData.get('tz') as string | null
  if (isValidTimeZone(picked)) return picked
  const { data: profile } = await admin.from('profiles').select('timezone').eq('id', userId).maybeSingle()
  return profile?.timezone || DEFAULT_TZ
}

// Creator of the event, community organizer/moderator, community owner, or
// platform staff — the same people who can delete it.
async function canManageEvent(admin: Admin, userId: string, communityId: string, role: string | undefined, createdBy: string) {
  const [{ data: communityRow }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id, slug, name').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', userId).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const allowed = createdBy === userId
    || ['organizer', 'moderator'].includes(role ?? '')
    || communityRow?.owner_id === userId
    || !!platformRole
  return { allowed, community: communityRow }
}

type EventRow = {
  id: string
  community_id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  location_type: string
  location_online: string | null
  location_address: string | null
  photos: string[] | null
  created_by: string
  series_id: string | null
}

function sameInstant(a: string | null, b: string | null) {
  if (!a || !b) return !a && !b
  return new Date(a).getTime() === new Date(b).getTime()
}

function describeLocation(type: string, online: string | null, address: string | null): string | null {
  if (type === 'in_person') return address || 'In person'
  if (type === 'hybrid') return [address, online].filter(Boolean).join(' · ') || 'Hybrid'
  return online || 'Online'
}

// The rows an edit touches: just this one, or (for a series) this and every later
// occurrence, earliest first.
async function affectedRows(admin: Admin, event: EventRow, scope: 'one' | 'future'): Promise<EventRow[]> {
  if (!event.series_id || scope === 'one') return [event]
  const { data } = await admin.from('events').select('*')
    .eq('series_id', event.series_id).gte('starts_at', event.starts_at)
    .order('starts_at', { ascending: true })
  return (data ?? []) as EventRow[]
}

// Distinct members (other than the editor) who RSVP'd Going/Maybe to any of the
// rows that have not ended yet. Shared by the warning and the send, so the number
// the editor is shown is the number that gets told.
async function attendeesToNotify(admin: Admin, rows: EventRow[], editorId: string): Promise<string[]> {
  const now = Date.now()
  const upcoming = rows.filter(r => new Date(r.ends_at ?? r.starts_at).getTime() >= now).map(r => r.id)
  if (!upcoming.length) return []
  const { data } = await admin.from('event_rsvps').select('user_id')
    .in('event_id', upcoming).in('status', ATTENDING)
  return [...new Set((data ?? []).map(r => r.user_id as string))].filter(id => id !== editorId)
}

// How many people the edit form should warn about before saving a time/place change.
export async function countEventChangeRecipients(
  eventId: string,
  communityId: string,
  scope: 'one' | 'future',
): Promise<{ count: number; error?: string }> {
  const { user, membership } = await getMembershipOrThrow(communityId)
  const admin = createAdminClient()
  const { data: event } = await admin.from('events').select('*').eq('id', eventId).single()
  if (!event || event.community_id !== communityId) return { count: 0, error: 'Event not found' }
  const { allowed } = await canManageEvent(admin, user.id, communityId, membership?.role, event.created_by)
  if (!allowed) return { count: 0, error: 'Not authorized' }
  const rows = await affectedRows(admin, event as EventRow, scope)
  return { count: (await attendeesToNotify(admin, rows, user.id)).length }
}

// scope (for recurring events):
//   'one'    – just this occurrence
//   'future' – this occurrence and all later ones; the series itself is re-anchored
//              on this occurrence so dates generated later follow the new pattern.
// Members who RSVP'd are told (bell + email) only when the time or location of
// the edited occurrence changed — a wording fix notifies no one.
export async function updateEvent(
  eventId: string,
  communityId: string,
  scope: 'one' | 'future',
  formData: FormData,
): Promise<{ error?: string; notified?: number }> {
  const { user, membership } = await getMembershipOrThrow(communityId)
  const admin = createAdminClient()

  const { data: eventData } = await admin.from('events').select('*').eq('id', eventId).single()
  const event = eventData as EventRow | null
  if (!event || event.community_id !== communityId) return { error: 'Event not found' }
  const { allowed, community } = await canManageEvent(admin, user.id, communityId, membership?.role, event.created_by)
  if (!allowed) return { error: 'Not authorized' }

  const title = ((formData.get('title') as string) || '').trim()
  if (!title) return { error: 'The event needs a title.' }
  const description = (formData.get('description') as string) || null
  const locationType = (formData.get('location_type') as string) || 'online'
  const locationOnline = locationType === 'in_person' ? null : ((formData.get('location_online') as string) || null)
  const locationAddress = locationType === 'online' ? null : ((formData.get('location_address') as string) || null)
  const photosRaw = formData.get('photos') as string | null
  const photos: string[] = photosRaw ? JSON.parse(photosRaw) : []

  const startWall = formData.get('starts_at') as string
  const endWall = (formData.get('ends_at') as string) || ''
  if (!startWall) return { error: 'The event needs a start time.' }
  const tz = await resolveFormTz(admin, user.id, formData)
  const startsAt = wallTimeToUtcIso(startWall, tz)
  const endsAt = endWall ? wallTimeToUtcIso(endWall, tz) : null
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) return { error: 'End time must be after start time.' }
  const durationMinutes = endsAt ? Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000) : null

  // Decided against the occurrence being edited — the same comparison the form
  // makes when it decides whether to show the warning.
  const timeChanged = !sameInstant(event.starts_at, startsAt) || !sameInstant(event.ends_at, endsAt)
  const locationChanged = event.location_type !== locationType
    || (event.location_online ?? null) !== locationOnline
    || (event.location_address ?? null) !== locationAddress

  const rows = await affectedRows(admin, event, scope)
  // Who to tell is worked out BEFORE the update, from the old times — a change
  // that moves an event into the past must still reach the people expecting it.
  const recipients = (timeChanged || locationChanged) ? await attendeesToNotify(admin, rows, user.id) : []

  const content = {
    title,
    description,
    location_type: locationType,
    location_online: locationOnline,
    location_address: locationAddress,
    photos,
  }

  if (!event.series_id || scope === 'one') {
    const { error } = await admin.from('events').update({
      ...content,
      starts_at: startsAt,
      ends_at: endsAt,
      // A new time needs a new reminder.
      ...(timeChanged ? { reminder_sent_at: null } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', eventId)
    if (error) return { error: 'Could not save the event. Please try again.' }
  } else {
    const { data: seriesData } = await admin.from('event_series').select('*').eq('id', event.series_id).single()
    const series = seriesData as SeriesRow | null
    if (!series) return { error: 'Could not find the repeating series for this event.' }

    // Re-time every affected occurrence from the new anchor, keeping its RSVPs
    // (rows are updated in place, never deleted and re-created).
    for (let j = 0; j < rows.length; j++) {
      const s = j === 0 ? startsAt : wallTimeToUtcIso(advanceWall(startWall, series.frequency, j), tz)
      const e = durationMinutes != null ? new Date(new Date(s).getTime() + durationMinutes * 60000).toISOString() : null
      const moved = !sameInstant(rows[j].starts_at, s) || !sameInstant(rows[j].ends_at, e)
      const { error } = await admin.from('events').update({
        ...content,
        starts_at: s,
        ends_at: e,
        ...(moved ? { reminder_sent_at: null } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', rows[j].id)
      if (error) return { error: 'Could not save every date in the series. Please try again.' }
    }

    // Re-anchor the series on this occurrence: index 0 is now this event, so the
    // generator resumes after the rows that already exist. A "repeat N times"
    // series keeps the same number of dates still to come.
    const alreadyBefore = Math.max(0, series.generated_count - rows.length)
    await admin.from('event_series').update({
      ...content,
      tz,
      start_wall: startWall,
      duration_minutes: durationMinutes,
      generated_count: rows.length,
      occurrence_count: series.end_type === 'count' && series.occurrence_count != null
        ? Math.max(rows.length, series.occurrence_count - alreadyBefore)
        : series.occurrence_count,
    }).eq('id', series.id)
  }

  const oldPhotos = event.photos ?? []
  const added = photos.filter(p => !oldPhotos.includes(p))
  const removed = oldPhotos.filter(p => !photos.includes(p))
  logAction({
    actorId: user.id, communityId, action: 'event.edited', targetId: eventId, targetType: 'event',
    metadata: {
      scope: event.series_id ? scope : 'one',
      time_changed: timeChanged,
      location_changed: locationChanged,
      notified: recipients.length,
      ...(timeChanged ? { before: event.starts_at, after: startsAt } : {}),
    },
  })
  if (added.length || removed.length) {
    logPhotos({ actorId: user.id, communityId, added, removed, source: 'event', parentId: event.series_id ?? eventId })
  }

  if (recipients.length) {
    await admin.from('notifications').insert(recipients.map(user_id => ({
      user_id,
      type: 'event_changed',
      actor_id: user.id,
      community_id: communityId,
      message_id: eventId, // generic target id: the edited event
    })))

    const location = describeLocation(locationType, locationOnline, locationAddress)
    const appliesToFollowing = !!event.series_id && scope === 'future' && rows.length > 1
    void (async () => {
      for (const userId of recipients) {
        const [{ data: authUser }, { data: prof }] = await Promise.all([
          admin.auth.admin.getUserById(userId),
          admin.from('profiles').select('timezone').eq('id', userId).maybeSingle(),
        ])
        const email = authUser.user?.email
        if (!email) continue
        await sendEmail(email, `Changed: ${title}`, eventChangedHtml({
          eventTitle: title,
          communityName: community?.name ?? 'your community',
          communitySlug: community?.slug ?? '',
          startsAt,
          endsAt,
          tz: prof?.timezone || undefined,
          timeChanged,
          location,
          locationChanged,
          appliesToFollowing,
        }))
      }
    })()
  }

  revalidatePath(`/communities/${community?.slug}`)
  return { notified: recipients.length }
}

async function getMembershipOrThrow(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from('community_members')
    .select('role, status')
    .eq('community_id', communityId)
    .eq('user_id', user.id)
    .maybeSingle()

  return { user, membership }
}

export async function createEvent(communityId: string, formData: FormData) {
  const { user, membership } = await getMembershipOrThrow(communityId)

  const admin = createAdminClient()
  const [{ data: communityRow }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id, slug').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isOwner = communityRow?.owner_id === user.id
  const isPlatformStaff = !!platformRole
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  if (!isMod && !isOwner && !isPlatformStaff) throw new Error('Only organizers and moderators can create events')

  const startsAt = formData.get('starts_at') as string
  const endsAt = formData.get('ends_at') as string
  const photosRaw = formData.get('photos') as string | null
  const photos: string[] = photosRaw ? JSON.parse(photosRaw) : []
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  const locationType = formData.get('location_type') as string
  const locationOnline = (formData.get('location_online') as string) || null
  const locationAddress = (formData.get('location_address') as string) || null

  // Interpret the entered wall-clock time in the zone picked on the form,
  // falling back to the creator's profile zone.
  const tz = await resolveFormTz(admin, user.id, formData)

  const template = {
    community_id: communityId,
    created_by: user.id,
    title,
    description,
    location_type: locationType,
    location_online: locationOnline,
    location_address: locationAddress,
    photos,
  }

  const repeat = (formData.get('repeat_frequency') as string) || 'none'

  if (repeat === 'none') {
    const { data: inserted } = await admin.from('events').insert({
      ...template,
      starts_at: wallTimeToUtcIso(startsAt, tz),
      ends_at: endsAt ? wallTimeToUtcIso(endsAt, tz) : null,
    }).select('id').single()

    if (inserted) {
      logAction({ actorId: user.id, communityId, action: 'event.created', targetId: inserted.id, targetType: 'event' })
      if (photos.length) logPhotos({ actorId: user.id, communityId, added: photos, source: 'event', parentId: inserted.id })
    }
  } else {
    // Recurring: create the series (rule + template) then materialize occurrences.
    const endType = ((formData.get('repeat_end_type') as string) || 'never') as EndType
    const countRaw = parseInt((formData.get('repeat_count') as string) || '', 10)
    const untilRaw = (formData.get('repeat_until') as string) || null

    const startUtc = wallTimeToUtcIso(startsAt, tz)
    const durationMinutes = endsAt
      ? Math.max(0, Math.round((new Date(wallTimeToUtcIso(endsAt, tz)).getTime() - new Date(startUtc).getTime()) / 60000))
      : null

    const { data: series } = await admin.from('event_series').insert({
      community_id: communityId,
      created_by: user.id,
      title,
      description,
      location_type: locationType,
      location_online: locationOnline,
      location_address: locationAddress,
      photos,
      tz,
      frequency: repeat as Frequency,
      start_wall: startsAt,
      duration_minutes: durationMinutes,
      end_type: endType,
      occurrence_count: endType === 'count' && countRaw > 0 ? countRaw : null,
      until_date: endType === 'until' ? untilRaw : null,
      generated_count: 0,
      active: true,
    }).select('*').single()

    if (series) {
      await generateForSeries(admin, series as SeriesRow)
      logAction({ actorId: user.id, communityId, action: 'event.created', targetId: series.id, targetType: 'event', metadata: { series: true, frequency: repeat } })
      if (photos.length) logPhotos({ actorId: user.id, communityId, added: photos, source: 'event', parentId: series.id })
    }
  }

  revalidatePath(`/communities/${communityRow?.slug}`)
}

// scope (for recurring events):
//   'one'    – just this occurrence
//   'future' – this occurrence + all later ones, and stop generating more
//   'series' – every occurrence (past + future) and the series itself
export async function deleteEvent(
  eventId: string,
  communityId: string,
  scope: 'one' | 'future' | 'series' = 'one',
): Promise<{ error?: string }> {
  const { user, membership } = await getMembershipOrThrow(communityId)

  const admin = createAdminClient()
  const { data: event } = await admin.from('events').select('created_by, series_id, starts_at').eq('id', eventId).single()
  if (!event) return { error: 'Event not found' }

  const [{ data: communityRow }, { data: platformRole }] = await Promise.all([
    admin.from('communities').select('owner_id, slug').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isCreator = event.created_by === user.id
  const isOwner = communityRow?.owner_id === user.id
  const isPlatformStaff = !!platformRole
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  if (!isCreator && !isMod && !isOwner && !isPlatformStaff) return { error: 'Not authorized' }

  const seriesId = event.series_id as string | null

  // Collect the photos on the event(s) about to be deleted, deduped across
  // occurrences (a series shares one photo set), so the removal can be audited.
  let affectedQuery = admin.from('events').select('photos')
  if (seriesId && scope === 'series') affectedQuery = affectedQuery.eq('series_id', seriesId)
  else if (seriesId && scope === 'future') affectedQuery = affectedQuery.eq('series_id', seriesId).gte('starts_at', event.starts_at)
  else affectedQuery = affectedQuery.eq('id', eventId)
  const { data: affectedRows } = await affectedQuery
  const removedPhotos = [...new Set((affectedRows ?? []).flatMap((r: { photos: string[] | null }) => r.photos ?? []))]

  if (seriesId && scope === 'series') {
    await admin.from('events').delete().eq('series_id', seriesId)
    await admin.from('event_series').delete().eq('id', seriesId)
  } else if (seriesId && scope === 'future') {
    // Delete this and all later occurrences, and stop the series from topping up.
    await admin.from('events').delete().eq('series_id', seriesId).gte('starts_at', event.starts_at)
    await admin.from('event_series').update({ active: false }).eq('id', seriesId)
  } else {
    await admin.from('events').delete().eq('id', eventId)
  }

  logAction({ actorId: user.id, communityId, action: 'event.deleted', targetId: eventId, targetType: 'event', metadata: { self: isCreator, scope: seriesId ? scope : 'one' } })
  if (removedPhotos.length) logPhotos({ actorId: user.id, communityId, removed: removedPhotos, source: 'event', parentId: eventId })

  revalidatePath(`/communities/${communityRow?.slug}`)
  return {}
}

export async function upsertRsvp(eventId: string, communityId: string, status: string | null) {
  const { user, membership } = await getMembershipOrThrow(communityId)
  if (!membership || membership.status !== 'active') throw new Error('Must be an active member to RSVP')

  const supabase = await createClient()

  if (status === null) {
    await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', user.id)
  } else {
    await supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: user.id, status })
  }

  const { data: community } = await createAdminClient().from('communities').select('slug').eq('id', communityId).single()
  revalidatePath(`/communities/${community?.slug}`)
}
