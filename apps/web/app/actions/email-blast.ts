'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { communityBlastHtml } from '@/lib/email'
import { Resend } from 'resend'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stoke.community'
const CHUNK_SIZE = 100

export async function sendEmailBlast(
  communityId: string,
  subject: string,
  body: string,
): Promise<{ error?: string; sent?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()

  // Must be organizer
  const { data: membership } = await admin
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  const { data: community } = await admin
    .from('communities')
    .select('name, owner_id')
    .eq('id', communityId)
    .single()

  const isOrganizer = membership?.role === 'organizer' || user.id === community?.owner_id
  if (!isOrganizer) return { error: 'Only organizers can send community emails' }

  // 24hr cooldown
  const { data: recentBlast } = await admin
    .from('email_blasts')
    .select('created_at')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentBlast) {
    const hoursSince = (Date.now() - new Date(recentBlast.created_at).getTime()) / 3600000
    if (hoursSince < 24) {
      const hoursLeft = Math.ceil(24 - hoursSince)
      return { error: `You can send one email per day. Next blast available in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}.` }
    }
  }

  if (!subject.trim() || !body.trim()) return { error: 'Subject and message are required' }

  // Get active members
  const { data: members } = await admin
    .from('community_members')
    .select('user_id')
    .eq('community_id', communityId)
    .eq('status', 'active')
    .neq('user_id', user.id) // don't email yourself

  if (!members?.length) return { error: 'No members to email' }

  const memberIds = new Set(members.map(m => m.user_id))

  // Get opted-out users
  const { data: unsubs } = await admin
    .from('email_unsubscribes')
    .select('user_id')
    .eq('community_id', communityId)

  const unsubIds = new Set((unsubs ?? []).map(u => u.user_id))

  // Fetch all auth users and filter to members
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const recipients = allUsers.filter(u => memberIds.has(u.id) && u.email && !unsubIds.has(u.id))

  if (!recipients.length) return { error: 'No eligible recipients (all members may have unsubscribed)' }

  // Send in chunks of 100 (Resend batch limit)
  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0

  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE)
    await resend.batch.send(
      chunk.map(u => ({
        from: `${community!.name} via Stoke <noreply@stoke.community>`,
        to: u.email!,
        subject,
        html: communityBlastHtml(
          subject,
          body,
          community!.name,
          `${BASE_URL}/api/unsubscribe?uid=${u.id}&cid=${communityId}`
        ),
      }))
    )
    sent += chunk.length
  }

  // Log the blast
  await admin.from('email_blasts').insert({
    community_id: communityId,
    sent_by: user.id,
    subject,
    recipient_count: sent,
  })

  return { sent }
}
