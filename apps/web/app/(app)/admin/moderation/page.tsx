import { createAdminClient } from '@/lib/supabase/admin'
import BanButton from '@/components/admin/BanButton'
import ReportActions from '@/components/admin/ReportActions'
import LocalDate from '@/components/LocalDate'
import Link from 'next/link'

export default async function AdminModerationPage() {
  const admin = createAdminClient()

  const [
    { data: bannedUsers },
    { data: platformReports },
    { data: communityReports },
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('id, username, display_name, avatar_url, created_at')
      .eq('is_banned', true)
      .order('updated_at', { ascending: false }),
    admin
      .from('reports')
      .select('id, created_at, reason, details, status, reporter:reporter_id(username, display_name), reported_user:reported_user_id(username, display_name)')
      .is('community_id', null)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('reports')
      .select('id, created_at, reason, details, status, reporter:reporter_id(username, display_name), reported_user:reported_user_id(username, display_name), community:community_id(name, slug)')
      .not('community_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const openPlatform = (platformReports ?? []).filter(r => r.status === 'open')
  const openCommunity = (communityReports ?? []).filter(r => r.status === 'open')
  const resolvedPlatform = (platformReports ?? []).filter(r => r.status !== 'open')
  const resolvedCommunity = (communityReports ?? []).filter(r => r.status !== 'open')

  function ReportRow({ r, communitySlug }: { r: NonNullable<typeof platformReports>[0] & { community?: { name: string; slug: string } | null }, communitySlug?: string }) {
    const reporter = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter
    const reported = Array.isArray(r.reported_user) ? r.reported_user[0] : r.reported_user
    return (
      <div className="flex items-start gap-3 px-4 py-3 text-sm bg-white">
        <span className="text-stone-400 text-xs shrink-0 mt-0.5 w-28">
          <LocalDate ts={r.created_at} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-medium text-stone-800">
            {reported?.display_name ?? reported?.username ?? 'Unknown'}
          </span>
          <span className="text-stone-500"> — {r.reason.replace(/_/g, ' ')}</span>
          {reporter && (
            <span className="text-stone-400 text-xs"> · by {reporter.display_name ?? reporter.username}</span>
          )}
          {r.details && (
            <p className="text-xs text-stone-500 mt-0.5 italic">"{r.details}"</p>
          )}
        </div>
        {r.status === 'open'
          ? <ReportActions reportId={r.id} communitySlug={communitySlug} />
          : <span className="text-xs text-stone-400 shrink-0 capitalize">{r.status}</span>
        }
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-stone-900 mb-1">Moderation</h1>
        <p className="text-sm text-stone-500">Reports and platform bans.</p>
      </div>

      {/* Platform reports */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-1">
          Platform reports {openPlatform.length > 0 && <span className="text-orange-500">({openPlatform.length} open)</span>}
        </h2>
        <p className="text-sm text-stone-500 mb-4">Reports with no community context — submitted from profile pages.</p>
        {platformReports?.length === 0 ? (
          <p className="text-sm text-stone-400">No platform reports.</p>
        ) : (
          <div className="space-y-4">
            {openPlatform.length > 0 && (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
                {openPlatform.map(r => <ReportRow key={r.id} r={r} />)}
              </div>
            )}
            {resolvedPlatform.length > 0 && (
              <details className="group">
                <summary className="text-xs text-stone-400 cursor-pointer hover:text-stone-600 select-none">
                  {resolvedPlatform.length} resolved
                </summary>
                <div className="mt-2 divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
                  {resolvedPlatform.map(r => <ReportRow key={r.id} r={r} />)}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Community reports */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-1">
          Community reports {openCommunity.length > 0 && <span className="text-orange-500">({openCommunity.length} open)</span>}
        </h2>
        <p className="text-sm text-stone-500 mb-4">Reports submitted within a specific community.</p>
        {communityReports?.length === 0 ? (
          <p className="text-sm text-stone-400">No community reports.</p>
        ) : (
          <div className="space-y-4">
            {openCommunity.length > 0 && (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
                {openCommunity.map(r => {
                  const community = Array.isArray((r as any).community) ? (r as any).community[0] : (r as any).community
                  return (
                    <div key={r.id} className="relative">
                      <ReportRow r={r} communitySlug={community?.slug} />
                      {community && (
                        <div className="px-4 pb-2">
                          <Link href={`/communities/${community.slug}`} className="text-xs text-stone-400 hover:text-orange-600">
                            in {community.name} →
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {resolvedCommunity.length > 0 && (
              <details className="group">
                <summary className="text-xs text-stone-400 cursor-pointer hover:text-stone-600 select-none">
                  {resolvedCommunity.length} resolved
                </summary>
                <div className="mt-2 divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
                  {resolvedCommunity.map(r => {
                    const community = Array.isArray((r as any).community) ? (r as any).community[0] : (r as any).community
                    return <ReportRow key={r.id} r={r} communitySlug={community?.slug} />
                  })}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Platform bans */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-3">
          Platform bans {bannedUsers?.length ? `(${bannedUsers.length})` : ''}
        </h2>
        {!bannedUsers?.length ? (
          <div className="bg-white rounded-xl border border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
            No platform bans
          </div>
        ) : (
          <div className="space-y-2">
            {bannedUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 p-3">
                <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-sm font-semibold text-stone-500 shrink-0 overflow-hidden">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    : ((u.display_name ?? u.username) || '?')[0].toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${u.username}`} className="text-sm font-medium text-stone-900 hover:underline">
                      {u.display_name ?? u.username}
                    </Link>
                    <span className="text-xs text-stone-400">@{u.username}</span>
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">banned</span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Joined {new Date(u.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
                <BanButton userId={u.id} isBanned={true} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
