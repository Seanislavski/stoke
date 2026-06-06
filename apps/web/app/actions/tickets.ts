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

  // Validate the user is a member of the tagged community (any membership level is fine)
  if (communityId) {
    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('community_members')
      .select('status')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (membership?.status !== 'active') return { error: 'You are not a member of that community' }
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
  const resolved = status === 'resolved' || status === 'closed'
  await admin.from('tickets').update({
    status,
    resolved_at: resolved ? new Date().toISOString() : null,
  }).eq('id', ticketId)
  revalidatePath(`/support/${ticketId}`)
  revalidatePath('/admin/support')
}

export async function getTicketReportData(
  period: 7 | 30 | 90,
  communityId?: string | null,
): Promise<{
  total: number
  resolved: number
  open: number
  avgResolutionHours: number | null
  medianResolutionHours: number | null
  byCategory: Array<{ category: string; count: number; avgHours: number | null }>
  oldestOpen: Array<{ id: string; title: string; category: string; ageHours: number; status: string }>
  communityName?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Auth check
  if (communityId) {
    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('community_members')
      .select('role, status')
      .eq('community_id', communityId)
      .eq('user_id', user.id)
      .maybeSingle()
    const { data: platformRole } = await supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle()
    const isOrgOrMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'
    if (!isOrgOrMod && !platformRole) throw new Error('Forbidden')
  } else {
    const { data: platformRole } = await supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (!platformRole) throw new Error('Forbidden')
  }

  const admin = createAdminClient()
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString()

  let query = admin
    .from('tickets')
    .select('id, title, category, status, created_at, resolved_at')
    .gte('created_at', since)

  if (communityId) {
    query = query.eq('community_id', communityId)
  }

  const { data: tickets } = await query

  let communityName: string | undefined
  if (communityId) {
    const { data: comm } = await admin.from('communities').select('name').eq('id', communityId).single()
    communityName = comm?.name
  }

  const rows = tickets ?? []
  const resolvedRows = rows.filter(t => t.status === 'resolved' || t.status === 'closed')
  const openRows = rows.filter(t => t.status === 'open' || t.status === 'in_progress')

  const resolutionHours = resolvedRows
    .filter(t => t.resolved_at)
    .map(t => (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000)

  const avg = resolutionHours.length
    ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
    : null

  const sorted = [...resolutionHours].sort((a, b) => a - b)
  const median = sorted.length
    ? sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    : null

  // By category
  const catMap = new Map<string, number[]>()
  for (const t of rows) {
    if (!catMap.has(t.category)) catMap.set(t.category, [])
    if ((t.status === 'resolved' || t.status === 'closed') && t.resolved_at) {
      const h = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000
      catMap.get(t.category)!.push(h)
    } else {
      catMap.get(t.category)! // ensure key exists
    }
  }
  const catCounts = new Map<string, number>()
  for (const t of rows) catCounts.set(t.category, (catCounts.get(t.category) ?? 0) + 1)

  const byCategory = Array.from(catCounts.entries()).map(([cat, count]) => {
    const hours = catMap.get(cat) ?? []
    return {
      category: cat,
      count,
      avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    }
  }).sort((a, b) => b.count - a.count)

  const oldestOpen = openRows
    .map(t => ({
      id: t.id,
      title: t.title ?? '',
      category: t.category,
      ageHours: (Date.now() - new Date(t.created_at).getTime()) / 3600000,
      status: t.status,
    }))
    .sort((a, b) => b.ageHours - a.ageHours)
    .slice(0, 8)

  return {
    total: rows.length,
    resolved: resolvedRows.length,
    open: openRows.length,
    avgResolutionHours: avg,
    medianResolutionHours: median,
    byCategory,
    oldestOpen,
    communityName,
  }
}
