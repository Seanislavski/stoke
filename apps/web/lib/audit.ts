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

export const ACTION_LABELS: Record<string, string> = {
  'member.joined': 'Joined community',
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
  'event.created': 'Created event',
  'event.deleted': 'Deleted event',
  'invite.created': 'Created invite link',
  'invite.revoked': 'Revoked invite link',
  'message.deleted': 'Deleted message',
  'message.restored': 'Restored message',
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
  'channel.created': 'Created channel',
  'channel.deleted': 'Deleted channel',
  'ticket.status_changed': 'Changed ticket status',
}
