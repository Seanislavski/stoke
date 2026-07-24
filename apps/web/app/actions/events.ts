'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction, logPhotos } from '@/lib/audit'
import { wallTimeToUtcIso, DEFAULT_TZ } from '@/lib/eventTime'
import { generateForSeries, type Frequency, type EndType, type SeriesRow } from '@/lib/eventSeries'

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

  // Interpret the entered wall-clock time in the creator's timezone.
  const { data: creatorProfile } = await admin
    .from('profiles').select('timezone').eq('id', user.id).maybeSingle()
  const tz = creatorProfile?.timezone || DEFAULT_TZ

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
