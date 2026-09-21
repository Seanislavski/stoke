import type { createAdminClient } from '@/lib/supabase/admin'
import { MILESTONES, type MilestoneRow } from '@/lib/milestones'

type Admin = ReturnType<typeof createAdminClient>

// Records any milestone this community has crossed but not yet recorded, and
// returns every milestone it has reached.
//
// Detection runs on the community page load rather than in the join actions on
// purpose: members arrive by open join, approved request, invite link, bulk add
// and Discord sign-in, and a check in each of those would drift. Counting on
// the page catches every path. The table's primary key makes recording
// idempotent — when two loads race, only the one whose insert actually lands
// gets rows back, so organizers are notified once.
//
// Milestones are never un-recorded: a community that loses members keeps its
// colour, the way a tree keeps its rings.
export async function recordMilestones(admin: Admin, communityId: string, activeCount: number): Promise<MilestoneRow[]> {
  const { data: existing } = await admin
    .from('community_milestones')
    .select('threshold, reached_at, backfilled')
    .eq('community_id', communityId)
  const rows: MilestoneRow[] = existing ?? []

  const have = new Set(rows.map(r => r.threshold))
  const crossed = MILESTONES.filter(m => m.threshold <= activeCount && !have.has(m.threshold))
  if (crossed.length === 0) return rows

  const { data: inserted } = await admin
    .from('community_milestones')
    .upsert(
      crossed.map(m => ({ community_id: communityId, threshold: m.threshold })),
      { onConflict: 'community_id,threshold', ignoreDuplicates: true },
    )
    .select('threshold, reached_at, backfilled')
  const fresh: MilestoneRow[] = inserted ?? []
  if (fresh.length === 0) return rows

  // A bulk add can cross several at once; celebrate only the biggest.
  const top = Math.max(...fresh.map(r => r.threshold))
  const { data: staff } = await admin
    .from('community_members')
    .select('user_id')
    .eq('community_id', communityId)
    .eq('status', 'active')
    .in('role', ['organizer', 'moderator'])
  if (staff && staff.length > 0) {
    // message_id is the notifications table's generic target id; here it
    // carries the threshold, which the bell renders. Awaited: a Supabase query
    // builder does not send anything until something calls then() on it.
    await admin.from('notifications').insert(
      staff.map(s => ({ user_id: s.user_id, type: 'milestone', community_id: communityId, message_id: String(top) })),
    )
  }

  return [...rows, ...fresh]
}
