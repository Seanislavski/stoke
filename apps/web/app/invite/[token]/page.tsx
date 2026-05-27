import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import JoinViaInviteButton from './JoinViaInviteButton'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('invites')
    .select('id, community_id, max_uses, use_count, expires_at')
    .eq('token', token)
    .maybeSingle()

  const expired = invite?.expires_at && new Date(invite.expires_at) < new Date()
  const exhausted = invite?.max_uses !== null && invite?.use_count != null && invite.max_uses !== null && invite.use_count >= invite.max_uses

  if (!invite || expired || exhausted) {
    return (
      <InvalidInvite reason={!invite ? 'invalid' : expired ? 'expired' : 'exhausted'} />
    )
  }

  const { data: community } = await admin
    .from('communities')
    .select('id, name, slug, description, join_mode')
    .eq('id', invite.community_id)
    .single()

  if (!community) return <InvalidInvite reason="invalid" />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let membershipStatus: string | null = null
  if (user) {
    const { data: membership } = await admin
      .from('community_members')
      .select('status')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .maybeSingle()
    membershipStatus = membership?.status ?? null
  }

  const joinLabel = community.join_mode === 'open' ? 'Join community' : 'Request to join'

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <div className="text-3xl mb-4">🔥</div>
        <h1 className="text-xl font-semibold text-stone-900 mb-1">{community.name}</h1>
        {community.description && (
          <p className="text-stone-500 text-sm mb-6">{community.description}</p>
        )}

        {!user && (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">Sign in to join this community.</p>
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="block w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Sign in
            </Link>
            <Link href={`/signup?redirect=/invite/${token}`} className="text-sm text-stone-500 hover:underline">
              Don't have an account? Sign up
            </Link>
          </div>
        )}

        {user && membershipStatus === 'active' && (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">You're already a member of this community.</p>
            <Link
              href={`/communities/${community.slug}`}
              className="block w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to community
            </Link>
          </div>
        )}

        {user && membershipStatus === 'pending' && (
          <p className="text-sm text-stone-500">Your request to join is pending approval.</p>
        )}

        {user && membershipStatus === 'banned' && (
          <p className="text-sm text-red-500">You have been banned from this community.</p>
        )}

        {user && !membershipStatus && (
          <JoinViaInviteButton token={token} label={joinLabel} slug={community.slug} joinMode={community.join_mode} />
        )}
      </div>
    </div>
  )
}

function InvalidInvite({ reason }: { reason: 'invalid' | 'expired' | 'exhausted' }) {
  const messages = {
    invalid: 'This invite link is invalid or has been revoked.',
    expired: 'This invite link has expired.',
    exhausted: 'This invite link has reached its maximum number of uses.',
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center">
        <div className="text-3xl mb-4">🔗</div>
        <h1 className="text-lg font-semibold text-stone-900 mb-2">Invalid invite link</h1>
        <p className="text-stone-500 text-sm mb-6">{messages[reason]}</p>
        <Link href="/communities" className="text-sm text-orange-600 hover:underline">
          Browse communities
        </Link>
      </div>
    </div>
  )
}
