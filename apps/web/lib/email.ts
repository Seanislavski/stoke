import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Stoke Community <noreply@stoke.community>'
const BASE_URL = 'https://stoke.community'

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
  } catch (err) {
    console.error('[email] send failed:', err)
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

function wrap(body: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#fafaf9;font-family:sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e7e5e4;">
  <div style="background:#f97316;padding:20px 24px;">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">Stoke Community</span>
  </div>
  <div style="padding:28px 24px;color:#1c1917;font-size:15px;line-height:1.6;">
    ${body}
  </div>
  <div style="padding:16px 24px;border-top:1px solid #f5f5f4;text-align:center;">
    <a href="${BASE_URL}" style="color:#a8a29e;font-size:12px;text-decoration:none;">stoke.community</a>
  </div>
</div>
</body></html>`
}

function btn(text: string, href: string) {
  return `<p style="margin:20px 0 0;">
    <a href="${href}" style="display:inline-block;background:#f97316;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">${text}</a>
  </p>`
}

export function joinRequestHtml(communityName: string, communitySlug: string, applicantUsername: string, applicantDisplayName: string | null) {
  const name = applicantDisplayName ?? applicantUsername
  return wrap(`
    <p style="margin:0 0 12px;"><strong>${name}</strong> (@${applicantUsername}) has requested to join <strong>${communityName}</strong>.</p>
    <p style="margin:0;color:#78716c;font-size:14px;">Visit the community settings to approve or reject this request.</p>
    ${btn('Review request', `${BASE_URL}/communities/${communitySlug}/settings?tab=members`)}
  `)
}

export function joinApprovedHtml(communityName: string, communitySlug: string) {
  return wrap(`
    <p style="margin:0 0 12px;">Your request to join <strong>${communityName}</strong> has been approved!</p>
    <p style="margin:0;color:#78716c;font-size:14px;">You're now a member. Come say hello.</p>
    ${btn('Go to community', `${BASE_URL}/communities/${communitySlug}`)}
  `)
}

export function joinRejectedHtml(communityName: string) {
  return wrap(`
    <p style="margin:0 0 12px;">Your request to join <strong>${communityName}</strong> was not approved at this time.</p>
    <p style="margin:0;color:#78716c;font-size:14px;">If you think this was a mistake, you can reach out to the community organizers directly.</p>
  `)
}

export function ticketReplyHtml(ticketId: string, ticketTitle: string, replierName: string) {
  return wrap(`
    <p style="margin:0 0 8px;"><strong>${replierName}</strong> replied to a support ticket:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-left:3px solid #f97316;color:#57534e;font-style:italic;">${ticketTitle}</p>
    ${btn('View ticket', `${BASE_URL}/support/${ticketId}`)}
  `)
}

export function eventReminderHtml(eventTitle: string, communityName: string, communitySlug: string, startsAt: string) {
  const time = new Date(startsAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
  return wrap(`
    <p style="margin:0 0 6px;color:#78716c;font-size:13px;">Starting in ~30 minutes</p>
    <p style="margin:0 0 4px;font-size:18px;font-weight:700;">${eventTitle}</p>
    <p style="margin:0 0 16px;color:#78716c;font-size:14px;">${communityName} &middot; ${time}</p>
    ${btn('View event', `${BASE_URL}/communities/${communitySlug}`)}
  `)
}
