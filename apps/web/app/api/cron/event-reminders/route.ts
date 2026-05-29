import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, eventReminderHtml } from '@/lib/email'

// Protected by CRON_SECRET env var.
// Configure a Railway cron job to call:
//   GET https://stoke.community/api/cron/event-reminders
//   Authorization: Bearer <CRON_SECRET>
// on a schedule like */10 * * * * (every 10 minutes).

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  // Find events starting in 25–35 minutes that haven't had a reminder sent
  const now = new Date()
  const windowStart = new Date(now.getTime() + 25 * 60 * 1000).toISOString()
  const windowEnd = new Date(now.getTime() + 35 * 60 * 1000).toISOString()

  const { data: events, error } = await admin
    .from('events')
    .select('id, title, starts_at, community_id')
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd)
    .is('reminder_sent_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!events || events.length === 0) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const event of events) {
    const { data: community } = await admin
      .from('communities')
      .select('name, slug')
      .eq('id', event.community_id)
      .single()
    if (!community) continue

    // Get RSVPs for going/maybe
    const { data: rsvps } = await admin
      .from('event_rsvps')
      .select('user_id')
      .eq('event_id', event.id)
      .in('status', ['going', 'maybe'])

    if (rsvps && rsvps.length > 0) {
      const html = eventReminderHtml(event.title, community.name, community.slug, event.starts_at)
      const subject = `Reminder: ${event.title} starts in 30 minutes`

      await Promise.all(
        rsvps.map(async (r) => {
          const { data } = await admin.auth.admin.getUserById(r.user_id)
          const email = data.user?.email
          if (email) {
            await sendEmail(email, subject, html)
            sent++
          }
        })
      )
    }

    // Mark reminder sent
    await admin.from('events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', event.id)
  }

  return NextResponse.json({ sent, events: events.length })
}
