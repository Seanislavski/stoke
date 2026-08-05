import { createAdminClient } from './supabase/admin'

export async function logAction(params: {
  actorId: string
  communityId?: string | null
  action: string
  targetUserId?: string | null
  targetId?: string | null
  targetType?: string | null
  metadata?: Record<string, unknown>
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      actor_id: params.actorId,
      community_id: params.communityId ?? null,
      action: params.action,
      target_user_id: params.targetUserId ?? null,
      target_id: params.targetId ?? null,
      target_type: params.targetType ?? null,
      metadata: params.metadata ?? {},
    })
  } catch {
    // Fire-and-forget — logging must never break the primary action
  }
}

// Log photo add/remove as itemized audit events. `source` names where the photo
// lives ('gallery' | 'bulletin' | 'event' | 'qa_question' | 'qa_answer'); the
// thumbnail URL + a link back to the parent ride in metadata for the renderers.
export function logPhotos(params: {
  actorId: string
  communityId?: string | null
  added?: string[]
  removed?: string[]
  source: string
  parentId?: string | null
}) {
  const emit = (action: 'photo.added' | 'photo.removed', url: string) =>
    logAction({
      actorId: params.actorId,
      communityId: params.communityId,
      action,
      targetId: params.parentId ?? null,
      targetType: 'photo',
      metadata: { source: params.source, url, parent_id: params.parentId ?? null },
    })
  for (const url of params.added ?? []) if (url) emit('photo.added', url)
  for (const url of params.removed ?? []) if (url) emit('photo.removed', url)
}

// Friendly names for a photo audit event's `metadata.source`.
export const PHOTO_SOURCE_LABELS: Record<string, string> = {
  gallery: 'community gallery',
  bulletin: 'bulletin post',
  event: 'event',
  qa_question: 'Q&A question',
  qa_answer: 'Q&A answer',
  chat: 'chat message',
  contest: 'contest entry',
}

export const ACTION_LABELS: Record<string, string> = {
  'member.joined': 'Joined community',
  'member.added': 'Added a member',
  'member.requested': 'Requested to join',
  'member.approved': 'Approved join request',
  'member.rejected': 'Rejected join request',
  'member.banned': 'Banned member',
  'member.unbanned': 'Unbanned member',
  'member.removed': 'Removed member',
  'member.role_changed': 'Changed member role',
  'post.created': 'Posted to bulletin',
  'post.submitted': 'Submitted post for review',
  'post.approved': 'Approved bulletin post',
  'post.rejected': 'Rejected bulletin post',
  'post.deleted': 'Deleted bulletin post',
  'resource.created': 'Added resource',
  'resource.submitted': 'Submitted resource for review',
  'resource.approved': 'Approved resource',
  'resource.rejected': 'Rejected resource',
  'resource.deleted': 'Deleted resource',
  'contest.created': 'Created a contest',
  'contest.edited': 'Edited a contest',
  'contest.status_changed': 'Changed a contest phase',
  'contest.winner_set': 'Set a contest winner',
  'contest.deleted': 'Deleted a contest',
  'entry.submitted': 'Submitted a contest entry',
  'entry.edited': 'Edited a contest entry',
  'entry.approved': 'Approved a contest entry',
  'entry.rejected': 'Rejected a contest entry',
  'entry.finalist_changed': 'Changed a contest finalist',
  'entry.deleted': 'Deleted a contest entry',
  'capture.published': 'Published a Discord capture',
  'capture.discarded': 'Discarded a Discord capture',
  'capture.claimed': 'Claimed a Discord capture',
  'photo.added': 'Added a photo',
  'photo.removed': 'Removed a photo',
  'question.created': 'Added a question',
  'question.submitted': 'Submitted a question for review',
  'question.approved': 'Approved a question',
  'question.recategorized': 'Changed a question’s category',
  'question.made_public': 'Made a question public',
  'question.made_private': 'Made a question private',
  'question.rejected': 'Rejected a question',
  'question.deleted': 'Deleted a question',
  'question.edited': 'Edited a question',
  'answer.created': 'Added an answer',
  'answer.submitted': 'Submitted an answer for review',
  'answer.approved': 'Approved an answer',
  'answer.rejected': 'Rejected an answer',
  'answer.deleted': 'Deleted an answer',
  'answer.edited': 'Edited an answer',
  'answer.accepted': 'Marked accepted answer',
  'qotw.published': 'Published a Question of the Week',
  'qotw.deleted': 'Deleted a Question of the Week',
  'review.created': 'Added a review',
  'review.submitted': 'Submitted a review',
  'review.edited': 'Edited a review (re-queued for approval)',
  'review.approved': 'Approved a review',
  'review.rejected': 'Rejected a review',
  'review.featured': 'Featured a review',
  'review.unfeatured': 'Unfeatured a review',
  'review.reordered': 'Reordered featured reviews',
  'review.replied': 'Replied to a review',
  'review.reply_removed': 'Removed a review reply',
  'review.deleted': 'Deleted a review',
  'event.created': 'Created event',
  'event.deleted': 'Deleted event',
  'invite.created': 'Created invite link',
  'invite.revoked': 'Revoked invite link',
  'message.deleted': 'Deleted message',
  'message.restored': 'Restored message',
  'message.edited': 'Edited message',
  'message.reverted': 'Reverted message edit',
  'platform.user.banned': 'Platform banned user',
  'platform.user.unbanned': 'Platform unbanned user',
  'platform.role.assigned': 'Assigned platform role',
  'platform.role.removed': 'Removed platform role',
  'ticket_category.created': 'Created ticket category',
  'ticket_category.deleted': 'Deleted ticket category',
  'ticket_category.enabled': 'Enabled ticket category',
  'ticket_category.disabled': 'Disabled ticket category',
  'email.blast': 'Sent email blast',
  'community.created': 'Created community',
  'community.settings_updated': 'Updated community settings',
  'community.listing_changed': 'Changed community listing status',
  'community.ownership_transferred': 'Transferred community ownership',
  'channel.created': 'Created channel',
  'channel.deleted': 'Deleted channel',
  'ticket.status_changed': 'Changed ticket status',
}
