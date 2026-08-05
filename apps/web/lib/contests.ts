// Single source of contest phase math, shared by the server actions and every
// page that renders a contest. Kept in one place for the same reason
// lib/qotw-schedule.ts exists: when the UI and the guards compute "can this
// person enter?" separately, they eventually disagree and the disagreement is
// invisible until someone hits it.

export type ContestStatus = 'draft' | 'submissions' | 'voting' | 'closed'
export type EntryStatus = 'pending' | 'approved' | 'rejected'

export const CONTEST_STATUS_LABELS: Record<ContestStatus, string> = {
  draft: 'Draft',
  submissions: 'Accepting entries',
  voting: 'Voting open',
  closed: 'Closed',
}

/** Mods advance phases by hand; these are the only moves allowed. */
export const ALLOWED_TRANSITIONS: Record<ContestStatus, ContestStatus[]> = {
  draft: ['submissions'],
  submissions: ['voting', 'draft'],
  voting: ['closed', 'submissions'],
  closed: ['voting'],
}

export function canTransition(from: ContestStatus, to: ContestStatus) {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export type ContestPhase = {
  status: ContestStatus
  submissions_close_at: string | null
  voting_close_at: string | null
}

/**
 * Entries are accepted only while the contest is in `submissions` AND the close
 * time (if set) hasn't passed. The deadline is enforced here rather than by a
 * scheduled job so a late entry can't slip in while a mod is asleep.
 */
export function submissionsOpen(contest: ContestPhase, now: Date = new Date()) {
  if (contest.status !== 'submissions') return false
  if (!contest.submissions_close_at) return true
  return new Date(contest.submissions_close_at).getTime() > now.getTime()
}

export function votingOpen(contest: ContestPhase) {
  return contest.status === 'voting'
}

/**
 * Vote counts stay hidden until the contest closes, so early votes don't
 * snowball into a bandwagon.
 */
export function countsVisible(contest: ContestPhase) {
  return contest.status === 'closed'
}

/**
 * Who may see which entries.
 *  - mods see everything, always
 *  - an entrant always sees their own entry, in every phase
 *  - everyone else sees approved finalists once voting opens, and all approved
 *    entries once the contest is closed
 */
export function canSeeEntry(
  entry: { author_id: string; status: EntryStatus; is_finalist: boolean },
  contest: ContestPhase,
  viewerId: string | null,
  isMod: boolean,
) {
  if (isMod) return true
  if (viewerId && entry.author_id === viewerId) return true
  if (entry.status !== 'approved') return false
  if (contest.status === 'voting') return entry.is_finalist
  return contest.status === 'closed'
}

/** A member-facing one-liner describing what's happening right now. */
export function phaseHint(contest: ContestPhase, now: Date = new Date()) {
  switch (contest.status) {
    case 'draft':
      return 'This contest hasn’t opened yet.'
    case 'submissions':
      return submissionsOpen(contest, now)
        ? 'Entries are open. Other entries stay hidden until voting begins.'
        : 'The entry deadline has passed. Finalists are being chosen.'
    case 'voting':
      return 'Vote for your favourite. Results are revealed when voting closes.'
    case 'closed':
      return 'This contest has finished.'
  }
}
