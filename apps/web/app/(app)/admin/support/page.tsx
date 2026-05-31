import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { getTicketCategories, buildCategoryLabels } from '@/lib/ticket-categories'
import CategoryManager from '@/components/tickets/CategoryManager'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-stone-100 text-stone-500',
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>
}) {
  const { status = 'active', category = '' } = await searchParams
  const admin = createAdminClient()

  const [categories, ticketsResult] = await Promise.all([
    getTicketCategories(),
    (async () => {
      let query = admin
        .from('tickets')
        .select('id, category, title, status, community_id, submitted_by, created_at, updated_at, communities(name, slug), profiles(username, display_name)')
        .order('updated_at', { ascending: false })
        .limit(100)

      if (status === 'active') {
        query = query.in('status', ['open', 'in_progress'])
      } else if (status === 'resolved') {
        query = query.in('status', ['resolved', 'closed'])
      }

      if (category) {
        query = query.eq('category', category)
      }

      return query
    })(),
  ])

  const { data: tickets } = ticketsResult
  const CATEGORY_LABELS = buildCategoryLabels(categories)

  const STATUSES = [
    { value: 'active', label: 'Active' },
    { value: 'resolved', label: 'Resolved/Closed' },
    { value: 'all', label: 'All' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-stone-900">Support Tickets</h1>
        <span className="text-sm text-stone-400">{tickets?.length ?? 0} shown</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
          {STATUSES.map(s => (
            <Link
              key={s.value}
              href={`/admin/support?status=${s.value}&category=${category}`}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${status === s.value ? 'bg-white text-stone-800 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <form method="GET" action="/admin/support" className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <select
            name="category"
            defaultValue={category}
            className="px-2 py-1 text-xs border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <button type="submit" className="px-2 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors">
            Filter
          </button>
        </form>
      </div>

      {/* Ticket list */}
      {!tickets?.length ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-400 text-sm">
          No tickets found.
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => {
            const community = Array.isArray(t.communities) ? t.communities[0] : t.communities
            const submitter = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles
            const date = new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

            return (
              <Link
                key={t.id}
                href={`/support/${t.id}`}
                className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-orange-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-xs text-stone-400">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                    {community && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{community.name}</span>
                    )}
                    <span className="text-xs text-stone-400">by {submitter?.display_name ?? submitter?.username}</span>
                  </div>
                  <p className="text-sm font-medium text-stone-900 truncate">{t.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5">Updated {date}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[t.status] ?? ''}`}>
                  {t.status.replace('_', ' ')}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      <CategoryManager categories={categories} />
    </div>
  )
}
