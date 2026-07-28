import { createAdminClient } from './supabase/admin'

// Stoke holds no Discord credentials — the Silas! bot does. When the platform
// needs to reach someone who exists only as a Discord identity (the author of an
// unclaimed capture, say), it queues the message here and Silas delivers it.
//
// See supabase/migrations/20260728000000_discord_outbox.sql.

export type DiscordDmKind = 'qotw_chosen'

// Links in a queued DM are rendered by the bot, off-platform, so they must be
// absolute and can't be derived from a request.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stoke.community'

/**
 * Queue a DM for Silas to deliver. Fire-and-forget by design: a queue write must
 * never fail the action that triggered it. A duplicate (same kind + capture) is
 * rejected by a unique index and swallowed here — re-running an action can't
 * double-message anyone.
 */
export async function enqueueDiscordDm(params: {
  communityId: string
  kind: DiscordDmKind
  discordUserId: string
  captureId?: string | null
  payload: Record<string, unknown>
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('discord_outbox').insert({
      community_id: params.communityId,
      kind: params.kind,
      discord_user_id: params.discordUserId,
      capture_id: params.captureId ?? null,
      payload: params.payload,
    })
  } catch {
    // queued messaging is best-effort; never break the primary action
  }
}
