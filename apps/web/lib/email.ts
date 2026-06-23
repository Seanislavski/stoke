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

export function ownershipTransferredHtml(communityName: string, communitySlug: string, previousOwnerName: string) {
  return wrap(`
    <p style="margin:0 0 12px;">You're now the owner of <strong>${communityName}</strong>.</p>
    <p style="margin:0 0 8px;color:#57534e;"><strong>${previousOwnerName}</strong> has transferred ownership of the community to you.</p>
    <p style="margin:0;color:#78716c;font-size:14px;">As the owner you can now appoint and manage organizers, transfer ownership, and your plan now governs this community's limits.</p>
    ${btn('Go to community', `${BASE_URL}/communities/${communitySlug}`)}
  `)
}

export function ticketReplyHtml(ticketId: string, ticketTitle: string, replierName: string) {
  return wrap(`
    <p style="margin:0 0 8px;"><strong>${replierName}</strong> replied to a support ticket:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-left:3px solid #f97316;color:#57534e;font-style:italic;">${ticketTitle}</p>
    ${btn('View ticket', `${BASE_URL}/support/${ticketId}`)}
  `)
}

export function communityBlastHtml(subject: string, body: string, communityName: string, unsubscribeUrl: string) {
  return wrap(`
    <p style="margin:0 0 4px;color:#78716c;font-size:13px;">Message from <strong>${communityName}</strong></p>
    <div style="margin:0 0 24px;white-space:pre-wrap;">${body.replace(/\n/g, '<br/>')}</div>
    <p style="margin:24px 0 0;font-size:11px;color:#a8a29e;border-top:1px solid #f5f5f4;padding-top:12px;">
      You're receiving this because you're a member of ${communityName} on Stoke Community.<br/>
      <a href="${unsubscribeUrl}" style="color:#a8a29e;">Unsubscribe from emails from this community</a>
    </p>
  `)
}

export function kbQuestionSubmittedHtml(communityName: string, communitySlug: string, questionTitle: string) {
  return wrap(`
    <p style="margin:0 0 8px;">A new question is awaiting review in <strong>${communityName}</strong>:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-left:3px solid #f97316;color:#57534e;">${questionTitle}</p>
    ${btn('Review question', `${BASE_URL}/communities/${communitySlug}?tab=qa`)}
  `)
}

export function kbQuestionApprovedHtml(communityName: string, communitySlug: string, questionId: string, questionTitle: string) {
  return wrap(`
    <p style="margin:0 0 8px;">Your question was published in <strong>${communityName}</strong>:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-left:3px solid #f97316;color:#57534e;">${questionTitle}</p>
    <p style="margin:0;color:#78716c;font-size:14px;">Members can now answer it.</p>
    ${btn('View question', `${BASE_URL}/communities/${communitySlug}/questions/${questionId}`)}
  `)
}

export function kbAnswerSubmittedHtml(communityName: string, communitySlug: string, questionId: string, questionTitle: string) {
  return wrap(`
    <p style="margin:0 0 8px;">A new answer is awaiting review in <strong>${communityName}</strong>, on:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-left:3px solid #f97316;color:#57534e;">${questionTitle}</p>
    ${btn('Review answer', `${BASE_URL}/communities/${communitySlug}/questions/${questionId}`)}
  `)
}

export function kbAnswerApprovedHtml(communityName: string, communitySlug: string, questionId: string, questionTitle: string) {
  return wrap(`
    <p style="margin:0 0 8px;">Your answer was published in <strong>${communityName}</strong>, on:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-left:3px solid #f97316;color:#57534e;">${questionTitle}</p>
    ${btn('View answer', `${BASE_URL}/communities/${communitySlug}/questions/${questionId}`)}
  `)
}

export function reviewSubmittedHtml(scopeName: string, reviewPath: string, snippet: string) {
  return wrap(`
    <p style="margin:0 0 8px;">A new review is awaiting approval for <strong>${scopeName}</strong>:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:#fafaf9;border-left:3px solid #f97316;color:#57534e;font-style:italic;">${snippet}</p>
    <p style="margin:0;color:#78716c;font-size:14px;">Approve it to show it to members, then feature it to display it publicly.</p>
    ${btn('Review it', `${BASE_URL}${reviewPath}`)}
  `)
}

export function reviewFeaturedHtml(scopeName: string, viewPath: string) {
  return wrap(`
    <p style="margin:0 0 12px;">Your review of <strong>${scopeName}</strong> is now featured!</p>
    <p style="margin:0;color:#78716c;font-size:14px;">It's being shown publicly as a testimonial. Thank you for sharing your experience.</p>
    ${btn('See where it appears', `${BASE_URL}${viewPath}`)}
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
