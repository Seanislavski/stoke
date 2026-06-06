import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('uid')
  const communityId = searchParams.get('cid')

  if (!userId || !communityId) {
    return new NextResponse('Invalid unsubscribe link.', { status: 400 })
  }

  const admin = createAdminClient()
  await admin.from('email_unsubscribes').upsert({ user_id: userId, community_id: communityId })

  return new NextResponse(
    `<!DOCTYPE html><html><body style="margin:0;padding:40px;font-family:sans-serif;background:#fafaf9;text-align:center;">
      <div style="max-width:400px;margin:0 auto;">
        <p style="font-size:18px;font-weight:600;color:#1c1917;">You've been unsubscribed.</p>
        <p style="color:#78716c;font-size:14px;">You won't receive community emails from this community anymore.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://stoke.community'}" style="display:inline-block;margin-top:20px;color:#f97316;font-size:14px;">Back to Stoke Community</a>
      </div>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}
