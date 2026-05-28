'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  const isOwner = !membership // owner may not be in community_members
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  if (!isMod && !isOwner) throw new Error('Only organizers and moderators can create events')

  const startsAt = formData.get('starts_at') as string
  const endsAt = formData.get('ends_at') as string

  const admin = createAdminClient()
  await admin.from('events').insert({
    community_id: communityId,
    created_by: user.id,
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    location_type: formData.get('location_type') as string,
    location_online: (formData.get('location_online') as string) || null,
    location_address: (formData.get('location_address') as string) || null,
  })

  const { data: community } = await admin.from('communities').select('slug').eq('id', communityId).single()
  revalidatePath(`/communities/${community?.slug}`)
}

export async function deleteEvent(eventId: string, communityId: string): Promise<{ error?: string }> {
  const { user, membership } = await getMembershipOrThrow(communityId)

  const admin = createAdminClient()
  const { data: event } = await admin.from('events').select('created_by').eq('id', eventId).single()
  if (!event) return { error: 'Event not found' }

  const isCreator = event.created_by === user.id
  const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '')
  if (!isCreator && !isMod) return { error: 'Not authorized' }

  await admin.from('events').delete().eq('id', eventId)

  const { data: community } = await admin.from('communities').select('slug').eq('id', communityId).single()
  revalidatePath(`/communities/${community?.slug}`)
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
