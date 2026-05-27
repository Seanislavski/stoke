import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReplyForm from '@/components/tickets/ReplyForm'
import StatusSelect from '@/components/tickets/StatusSelect'

const CATEGORY_LABELS: Record<string, string> = {
  account_issue: 'Account Issue',
  report_user: 'Report a User',
  bug_report: 'Bug Report',
  community_issue: 'Community Issue',
  other: 'Other',
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-stone-100 text-stone-500',
}

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from('tickets')
    .select('id, category, title, status, community_id, submitted_by, created_at, communities(name, slug), profiles(username, display_name)')
    .eq('id', ticketId)
    .single()

  if (!ticket) notFound()

  // Check access
  const { data: platformRole } = await supabase.from('platform_roles').select('role').eq('user_id', user!.id).maybeSingle()
  const isStaff = !!platformRole
  const isSubmitter = ticket.submitted_by === user!.id

  let isCommunityMod = false
  if (ticket.community_id) {
    const { data: membership } = await admin
      .from('community_members')
      .select('role, status')
      .eq('community_id', ticket.community_id)
      .eq('user_id', user!.id)
      .maybeSingle()
    isCommunityMod = ['organizer', 'moderator'].includes(membership?.role ?? '') && membership?.status === 'active'
  }

  if (!isSubmitter && !isStaff && !isCommunityMod) notFound()

  const { data: replies } = await admin
    .from('ticket_replies')
    .select('id, content, created_at, author_id, profiles(username, display_name, avatar_url)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })

  const community = Array.isArray(ticket.communities) ? ticket.communities[0] : ticket.communities
  const submitter = Array.isArray(ticket.profiles) ? ticket.profiles[0] : ticket.profiles

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/support" className="text-sm text-stone-400 hover:text-stone-600">← Back to support</Link>
      </div>

      {/* Ticket header */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs text-stone-400">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
              {community && (
                <Link href={`/communities/${community.slug}`} className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded hover:underline">
                  {community.name}
                </Link>
              )}
            </div>
            <h1 className="text-lg font-semibold text-stone-900">{ticket.title}</h1>
            <p className="text-xs text-stone-400 mt-1">
              Opened by {submitter?.display_name ?? submitter?.username} · {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="shrink-0">
            {isStaff ? (
              <StatusSelect ticketId={ticket.id} currentStatus={ticket.status} />
            ) : (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[ticket.status] ?? ''}`}>
                {ticket.status.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="space-y-4 mb-6">
        {replies?.map(reply => {
          const author = Array.isArray(reply.profiles) ? reply.profiles[0] : reply.profiles
          const isOwn = reply.author_id === user!.id
          const date = new Date(reply.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            ' at ' + new Date(reply.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

          return (
            <div key={reply.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-semibold text-stone-500 shrink-0">
                {((author?.display_name ?? author?.username) || '?')[0].toUpperCase()}
              </div>
              <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`rounded-xl px-4 py-3 text-sm ${isOwn ? 'bg-orange-500 text-white' : 'bg-white border border-stone-200 text-stone-800'}`}>
                  <p className="whitespace-pre-wrap">{reply.content}</p>
                </div>
                <p className="text-xs text-stone-400 mt-1 px-1">
                  {author?.display_name ?? author?.username} · {date}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Reply form (not for closed tickets) */}
      {ticket.status !== 'closed' && (
        <ReplyForm ticketId={ticket.id} />
      )}
      {ticket.status === 'closed' && (
        <p className="text-sm text-stone-400 text-center">This ticket is closed.</p>
      )}
    </div>
  )
}
