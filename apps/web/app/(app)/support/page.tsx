import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import NewTicketForm from '@/components/tickets/NewTicketForm'
import { getTicketCategories, buildCategoryLabels } from '@/lib/ticket-categories'
import DownloadReportButton from '@/components/tickets/DownloadReportButton'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-stone-100 text-stone-500',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const categories = await getTicketCategories()
  const CATEGORY_LABELS = buildCategoryLabels(categories)
  const activeCategories = categories.filter(c => c.is_active).map(c => ({ key: c.key, label: c.label }))

  // My tickets
  const { data: myTickets } = await admin
    .from('tickets')
    .select('id, category, title, status, community_id, created_at, communities(name, slug)')
    .eq('submitted_by', user!.id)
    .order('updated_at', { ascending: false })

  // All communities user is a member of (for ticket community dropdown)
  const { data: allMemberships } = await admin
    .from('community_members')
    .select('community_id, role, communities(id, name, slug)')
    .eq('user_id', user!.id)
    .eq('status', 'active')

  const allCommunities = (allMemberships ?? []).map(m => {
    const c = Array.isArray(m.communities) ? m.communities[0] : m.communities
    return c ? { id: c.id, name: c.name } : null
  }).filter(Boolean) as { id: string; name: string }[]

  // Organizer/mod communities only — for the community tickets section
  const orgCommunities = (allMemberships ?? [])
    .filter(m => ['organizer', 'moderator'].includes(m.role))
    .map(m => {
      const c = Array.isArray(m.communities) ? m.communities[0] : m.communities
      return c ? { id: c.id, name: c.name } : null
    }).filter(Boolean) as { id: string; name: string }[]

  const communityIds = orgCommunities.map(c => c.id)

  // Community tickets (others' tickets tagged to my communities)
  const { data: communityTickets } = communityIds.length
    ? await admin
        .from('tickets')
        .select('id, category, title, status, community_id, submitted_by, created_at, communities(name, slug), profiles(username, display_name)')
        .in('community_id', communityIds)
        .neq('submitted_by', user!.id)
        .order('updated_at', { ascending: false })
    : { data: null }

  const openMine = myTickets?.filter(t => t.status !== 'closed' && t.status !== 'resolved') ?? []
  const closedMine = myTickets?.filter(t => t.status === 'closed' || t.status === 'resolved') ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-900">Support</h1>
      </div>
      <NewTicketForm orgCommunities={allCommunities} categories={activeCategories} />

      {/* My open tickets */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
          My tickets {openMine.length > 0 ? `(${openMine.length})` : ''}
        </h2>
        {openMine.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-5 text-center text-stone-400 text-sm">
            No open tickets.
          </div>
        ) : (
          <div className="space-y-2">
            {openMine.map(t => <TicketRow key={t.id} ticket={t} categoryLabels={CATEGORY_LABELS} />)}
          </div>
        )}
      </section>

      {/* Community tickets */}
      {orgCommunities.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
              Community tickets {communityTickets && communityTickets.length > 0 ? `(${communityTickets.length})` : ''}
            </h2>
            <DownloadReportButton
              communities={orgCommunities}
              defaultCommunityId={orgCommunities.length === 1 ? orgCommunities[0].id : undefined}
            />
          </div>
          {communityTickets && communityTickets.length > 0 ? (
            <div className="space-y-2">
              {communityTickets.map(t => <TicketRow key={t.id} ticket={t} showAuthor categoryLabels={CATEGORY_LABELS} />)}
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl p-5 text-center text-stone-400 text-sm">
              No community tickets yet.
            </div>
          )}
        </section>
      )}

      {/* Closed/resolved tickets */}
      {closedMine.length > 0 && (
        <details>
          <summary className="text-xs font-medium text-stone-400 uppercase tracking-wide cursor-pointer hover:text-stone-600 select-none mb-3">
            Closed tickets ({closedMine.length})
          </summary>
          <div className="space-y-2 mt-3">
            {closedMine.map(t => <TicketRow key={t.id} ticket={t} categoryLabels={CATEGORY_LABELS} />)}
          </div>
        </details>
      )}
    </div>
  )
}

type TicketRowProps = {
  ticket: {
    id: string
    category: string
    title: string
    status: string
    community_id: string | null
    created_at: string
    communities?: { name: string; slug: string } | { name: string; slug: string }[] | null
    profiles?: { username: string; display_name: string | null } | { username: string; display_name: string | null }[] | null
  }
  showAuthor?: boolean
  categoryLabels: Record<string, string>
}

function TicketRow({ ticket, showAuthor, categoryLabels }: TicketRowProps) {
  const community = Array.isArray(ticket.communities) ? ticket.communities[0] : ticket.communities
  const author = Array.isArray(ticket.profiles) ? ticket.profiles[0] : ticket.profiles
  const date = new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <Link
      href={`/support/${ticket.id}`}
      className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-orange-300 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs text-stone-400">{categoryLabels[ticket.category] ?? ticket.category}</span>
          {community && (
            <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{community.name}</span>
          )}
          {showAuthor && author && (
            <span className="text-xs text-stone-400">by {author.display_name ?? author.username}</span>
          )}
        </div>
        <p className="text-sm font-medium text-stone-900 truncate">{ticket.title}</p>
        <p className="text-xs text-stone-400 mt-0.5">{date}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[ticket.status] ?? ''}`}>
        {STATUS_LABELS[ticket.status] ?? ticket.status}
      </span>
    </Link>
  )
}
