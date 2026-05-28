import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TicketThread from '@/components/tickets/TicketThread'
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

  const normalizedReplies = (replies ?? []).map(r => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
  }))

  const profileCache: Record<string, { username: string; display_name: string | null; avatar_url?: string | null }> = {}
  for (const r of normalizedReplies) {
    if (r.profiles && r.author_id) profileCache[r.author_id] = r.profiles
  }
  if (!profileCache[user!.id]) {
    const { data: myProfile } = await admin.from('profiles').select('username, display_name, avatar_url').eq('id', user!.id).single()
    if (myProfile) profileCache[user!.id] = myProfile
  }

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

      {/* Thread + reply */}
      <TicketThread
        ticketId={ticket.id}
        currentUserId={user!.id}
        initialReplies={normalizedReplies as Parameters<typeof TicketThread>[0]['initialReplies']}
        initialProfiles={profileCache}
        isClosed={ticket.status === 'closed'}
      />
    </div>
  )
}
