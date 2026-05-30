'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, ticketReplyHtml } from '@/lib/email'

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
  const category = formData.get('category') as string

  // Validate community access if tagged — skip mod check for report_user (any member can file)
  if (communityId && category !== 'report_user') {
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
    category,
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

export async function addReply(ticketId: string, content: string): Promise<{ error?: string }> {
  const { user, ticket, isStaff } = await getAccessOrThrow(ticketId)
  const admin = createAdminClient()

  const [{ data: replyRow, error }, { data: authorProfile }] = await Promise.all([
    admin.from('ticket_replies').insert({ ticket_id: ticketId, author_id: user.id, content }).select('id').single(),
    admin.from('profiles').select('display_name, username').eq('id', user.id).single(),
  ])
  if (error) return { error: error.message }

  await admin.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId)

  // Notify the other party
  void (async () => {
    const replierName = authorProfile?.display_name ?? authorProfile?.username ?? 'Someone'
    const html = ticketReplyHtml(ticketId, ticket.title ?? ticket.subject ?? 'Support ticket', replierName)
    const subject = `New reply on: ${ticket.title ?? ticket.subject ?? 'Support ticket'}`
    if (isStaff) {
      // Staff replied → notify submitter
      const { data } = await admin.auth.admin.getUserById(ticket.submitted_by)
      const email = data.user?.email
      if (email) await sendEmail(email, subject, html)
    } else {
      // User replied → notify platform support staff via support inbox env var
      const supportEmail = process.env.SUPPORT_EMAIL
      if (supportEmail) await sendEmail(supportEmail, `[Staff reply needed] ${subject}`, html)
    }
  })()

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
