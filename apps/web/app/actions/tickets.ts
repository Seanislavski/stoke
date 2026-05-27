'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAccessOrThrow(ticketId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { data: ticket } = await admin.from('tickets').select('*').eq('id', ticketId).single()
  if (!ticket) throw new Error('Ticket not found')

  const { data: platformRole } = await supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle()
  const isStaff = !!platformRole

  const isSubmitter = ticket.submitted_by === user.id

  let isCommunityMod = false
  if (ticket.community_id) {
    const { data: membership } = await admin
      .from('community_members')
      .select('role, status')
      .eq('community_id', ticket.community_id)
      .eq('user_id', user.id)
      .maybeSingle()
    isCommunityMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'
  }

  if (!isSubmitter && !isStaff && !isCommunityMod) throw new Error('Forbidden')
  return { user, ticket, isStaff, isSubmitter, isCommunityMod }
}

export async function createTicket(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' }

  const communityId = (formData.get('community_id') as string) || null

  // Validate community access if tagged
  if (communityId) {
    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('community_members')
      .select('role, status')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .maybeSingle()
    const { data: community } = await admin.from('communities').select('owner_id').eq('id', communityId).single()
    const isMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'
    const isOwner = community?.owner_id === user.id
    if (!isMod && !isOwner) return { error: 'You are not a moderator of that community' }
  }

  const admin = createAdminClient()
  const { data: ticket, error } = await admin.from('tickets').insert({
    submitted_by: user.id,
    category: formData.get('category') as string,
    title: formData.get('title') as string,
    community_id: communityId,
  }).select('id').single()

  if (error || !ticket) return { error: error?.message ?? 'Failed to create ticket' }

  // First reply = initial message
  await admin.from('ticket_replies').insert({
    ticket_id: ticket.id,
    author_id: user.id,
    content: formData.get('message') as string,
  })

  revalidatePath('/support')
  return { ticketId: ticket.id }
}

export async function addReply(ticketId: string, content: string) {
  const { user } = await getAccessOrThrow(ticketId)
  const admin = createAdminClient()
  await admin.from('ticket_replies').insert({ ticket_id: ticketId, author_id: user.id, content })
  await admin.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)
  revalidatePath(`/support/${ticketId}`)
  revalidatePath('/admin/support')
  return {}
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: platformRole } = await supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle()
  if (!platformRole) throw new Error('Forbidden')

  const admin = createAdminClient()
  await admin.from('tickets').update({ status }).eq('id', ticketId)
  revalidatePath(`/support/${ticketId}`)
  revalidatePath('/admin/support')
}
