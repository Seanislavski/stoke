import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import RichContent from '@/components/RichContent'
import PhotoGallery from '@/components/PhotoGallery'
import LocalDate from '@/components/LocalDate'
import SubmitEntryForm from '@/components/contests/SubmitEntryForm'
import EntryModActions from '@/components/contests/EntryModActions'
import VoteButton from '@/components/contests/VoteButton'
import ContestPhaseControls from '@/components/contests/ContestPhaseControls'
import {
  CONTEST_STATUS_LABELS, canSeeEntry, countsVisible, phaseHint,
  submissionsOpen, votingOpen, type ContestStatus,
} from '@/lib/contests'

type Profile = { username: string; display_name: string | null }

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}
function nameOf(p: Profile | null) {
  return p ? (p.display_name ?? p.username) : 'Unknown'
}

export default async function ContestPage({
  params,
}: {
  params: Promise<{ slug: string; contestId: string }>
}) {
  const { slug, contestId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, owner_id, has_contests')
    .eq('slug', slug)
    .single()
  if (!community) notFound()

  const admin = createAdminClient()
  const [{ data: myMembership }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', community.id).eq('user_id', user.id).maybeSingle(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])

  const isMember = myMembership?.status === 'active'
  const isMod = !!platformRole || user.id === community.owner_id || ['organizer', 'moderator'].includes(myMembership?.role ?? '')
  if (!isMember && !isMod) notFound()

  const { data: contest } = await admin
    .from('contests')
    .select('id, title, description, rules, terms, status, submissions_close_at, voting_close_at, max_entries_per_member, winner_entry_id, created_at')
    .eq('id', contestId)
    .eq('community_id', community.id)
    .single()
  if (!contest) notFound()

  // A draft is still being written; members shouldn't stumble into it by URL.
  const status = contest.status as ContestStatus
  if (status === 'draft' && !isMod) notFound()

  // ⚠️ contest_entries has two FKs to profiles (author_id, approved_by), so the
  // join needs the !author_id hint or PostgREST silently returns null.
  const { data: entryRows } = await admin
    .from('contest_entries')
    .select('id, title, description, photos, status, is_finalist, author_id, created_at, profiles!author_id(username, display_name)')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true })

  const entries = entryRows ?? []

  // Counts are only ever fetched once they're allowed to be shown, so a curious
  // member can't read the running tally out of the page payload mid-vote.
  let countByEntry: Record<string, number> = {}
  if (countsVisible(contest)) {
    const { data: votes } = await admin.from('contest_votes').select('entry_id').eq('contest_id', contestId)
    countByEntry = (votes ?? []).reduce<Record<string, number>>((acc, v) => {
      acc[v.entry_id] = (acc[v.entry_id] ?? 0) + 1
      return acc
    }, {})
  }

  const { data: myVote } = await admin
    .from('contest_votes')
    .select('entry_id')
    .eq('contest_id', contestId)
    .eq('voter_id', user.id)
    .maybeSingle()

  const visible = entries.filter(e => canSeeEntry(e, contest, user.id, isMod))
  const myEntries = entries.filter(e => e.author_id === user.id)
  const canEnter =
    submissionsOpen(contest) &&
    (isMember || isMod) &&
    myEntries.filter(e => e.status !== 'rejected').length < contest.max_entries_per_member

  const finalists = entries.filter(e => e.is_finalist && e.status === 'approved')
  const winner = contest.winner_entry_id ? entries.find(e => e.id === contest.winner_entry_id) ?? null : null
  const pendingCount = entries.filter(e => e.status === 'pending').length

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <Link href={`/communities/${slug}?tab=contests`} className="text-sm text-stone-500 hover:text-stone-700">
        ← {community.name}
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-stone-900">{contest.title}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
            status === 'voting' ? 'bg-orange-100 text-orange-700'
              : status === 'submissions' ? 'bg-green-100 text-green-700'
              : status === 'closed' ? 'bg-stone-100 text-stone-500'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {CONTEST_STATUS_LABELS[status]}
          </span>
        </div>

        <p className="text-sm text-stone-500">{phaseHint(contest)}</p>

        {contest.description && (
          <div className="text-stone-700 text-sm"><RichContent content={contest.description} /></div>
        )}

        {contest.rules && (
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Rules</p>
            <div className="text-sm text-stone-600"><RichContent content={contest.rules} /></div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-400 pt-1">
          {contest.submissions_close_at && (
            <span>Entries close <LocalDate ts={contest.submissions_close_at} /></span>
          )}
          {contest.voting_close_at && (
            <span>Voting closes <LocalDate ts={contest.voting_close_at} /></span>
          )}
          <span>
            {contest.max_entries_per_member} entr{contest.max_entries_per_member === 1 ? 'y' : 'ies'} per member
          </span>
        </div>
      </div>

      {isMod && (
        <ContestPhaseControls
          contestId={contest.id}
          slug={slug}
          status={status}
          finalists={finalists.map(f => ({ id: f.id, title: f.title }))}
          winnerEntryId={contest.winner_entry_id}
        />
      )}

      {isMod && pendingCount > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          {pendingCount} {pendingCount === 1 ? 'entry is' : 'entries are'} waiting for review.
        </p>
      )}

      {/* Winner */}
      {winner && (
        <div className="bg-white rounded-xl border-2 border-orange-300 p-6">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">🏆 Winner</p>
          <h2 className="text-lg font-bold text-stone-900">{winner.title}</h2>
          <p className="text-sm text-stone-500 mb-3">by {nameOf(one<Profile>(winner.profiles))}</p>
          {winner.photos?.length > 0 && <PhotoGallery photos={winner.photos} />}
        </div>
      )}

      {/* Entry form */}
      {canEnter && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h2 className="text-sm font-semibold text-stone-900 mb-3">Enter this contest</h2>
          <SubmitEntryForm contestId={contest.id} terms={contest.terms} />
        </div>
      )}

      {/* Entries */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
          {status === 'voting' ? 'Finalists' : status === 'closed' ? 'All entries' : 'Entries'}
          {visible.length > 0 && <span className="text-stone-400 font-normal"> · {visible.length}</span>}
        </h2>

        {visible.length === 0 ? (
          <p className="text-sm text-stone-400 bg-white border border-stone-200 rounded-xl p-6 text-center">
            {status === 'submissions'
              ? 'No entries from you yet. Other people’s entries stay hidden until voting opens.'
              : 'Nothing to show here yet.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visible.map(entry => {
              const author = one<Profile>(entry.profiles)
              const isMine = entry.author_id === user.id
              return (
                <div key={entry.id} className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col">
                  {entry.photos?.length > 0 && (
                    <div className="mb-3"><PhotoGallery photos={entry.photos} /></div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-900">{entry.title}</h3>
                    {entry.is_finalist && status !== 'closed' && (
                      <span className="text-xs text-orange-600 shrink-0">★</span>
                    )}
                  </div>

                  <p className="text-xs text-stone-400 mt-0.5">
                    by {nameOf(author)}
                    {isMine && <span className="text-orange-600"> · your entry</span>}
                  </p>

                  {entry.description && (
                    <p className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">{entry.description}</p>
                  )}

                  {/* An entrant needs to know where their own entry stands. */}
                  {isMine && entry.status !== 'approved' && (
                    <p className={`text-xs mt-2 ${entry.status === 'rejected' ? 'text-red-600' : 'text-amber-700'}`}>
                      {entry.status === 'rejected' ? 'Not accepted for this contest.' : 'Waiting for an organizer to review it.'}
                    </p>
                  )}

                  {countsVisible(contest) && (
                    <p className="text-xs text-stone-500 mt-2">
                      {countByEntry[entry.id] ?? 0} vote{(countByEntry[entry.id] ?? 0) === 1 ? '' : 's'}
                    </p>
                  )}

                  <div className="mt-auto">
                    {votingOpen(contest) && entry.is_finalist && (
                      <VoteButton
                        contestId={contest.id}
                        entryId={entry.id}
                        isMyVote={myVote?.entry_id === entry.id}
                        canVote={isMember}
                      />
                    )}

                    {isMine && submissionsOpen(contest) && (
                      <div className="mt-3">
                        <SubmitEntryForm
                          contestId={contest.id}
                          terms={contest.terms}
                          entry={{ id: entry.id, title: entry.title, description: entry.description, photos: entry.photos ?? [] }}
                        />
                      </div>
                    )}

                    {isMod && (
                      <EntryModActions
                        entryId={entry.id}
                        status={entry.status}
                        isFinalist={entry.is_finalist}
                        showFinalist={status !== 'draft'}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
