import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const admin = createAdminClient()

  // Look up case-insensitively via the generated column — 43 of 82 members have
  // capitals, so /profile/sean must find "Sean" rather than 404 on a link
  // someone retyped or a phone auto-capitalised.
  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, show_memberships, created_at, discord_username, show_discord')
    .eq('username_lower', username.toLowerCase())
    .maybeSingle()

  if (!profile) notFound()

  // Send everyone to the one true spelling, so a profile has a single address.
  if (profile.username !== username) redirect(`/profile/${profile.username}`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isOwn = user?.id === profile.id

  let platformRole: { role: string } | null = null
  if (user) {
    const { data } = await supabase.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle()
    platformRole = data
  }
  const isStaff = !!platformRole

  let profileEmail: string | null = null
  if (isStaff) {
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
    profileEmail = authUser.user?.email ?? null
  }

  let memberships: { communities: { name: string; slug: string }[] }[] = []
  if (profile.show_memberships) {
    const { data } = await admin
      .from('community_members')
      .select('communities(name, slug)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
    memberships = (data ?? []) as typeof memberships
  }

  const joinedYear = new Date(profile.created_at).getFullYear()
  const joinedFull = new Date(profile.created_at).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
  const initials = (profile.display_name ?? profile.username)[0].toUpperCase()

  return (
    <div className="max-w-2xl">
      <BackButton />

      {/* Header */}
      <div className="flex items-start gap-5 mb-6">
        <div className="w-20 h-20 rounded-full bg-stone-200 overflow-hidden flex-shrink-0 photo-pop">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.display_name ?? profile.username}
              width={80}
              height={80}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-400 text-2xl font-semibold">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-stone-900">
              {profile.display_name ?? profile.username}
            </h1>
            {isOwn && (
              <Link
                href="/settings/profile"
                className="text-xs text-orange-600 hover:underline"
              >
                Edit profile
              </Link>
            )}
            {!isOwn && user && (
              <Link
                href={`/support?category=report_user&subject=${encodeURIComponent(`Report @${profile.username}`)}`}
                className="text-xs text-stone-400 hover:text-red-500 transition-colors"
              >
                Report
              </Link>
            )}
          </div>
          <p className="text-sm text-stone-500">@{profile.username}</p>
          <p className="text-xs text-stone-400 mt-1">Member since {joinedYear}</p>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <p className="text-stone-700 text-sm mb-6 whitespace-pre-wrap">{profile.bio}</p>
      )}

      {/* Discord — shown only when the member has opted in. */}
      {profile.show_discord && profile.discord_username && (
        <p className="mb-6 flex items-center gap-2 text-sm text-stone-600">
          <span className="text-stone-400">Discord</span>
          <span className="rounded-md bg-stone-100 px-2 py-1 font-mono text-xs text-stone-700">
            {profile.discord_username}
          </span>
        </p>
      )}

      {/* Communities */}
      {profile.show_memberships && memberships.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-stone-700 mb-3">Communities</h2>
          <div className="flex flex-wrap gap-2">
            {memberships.map((m, i) => {
              const community = Array.isArray(m.communities) ? m.communities[0] : m.communities
              if (!community) return null
              return (
                <Link
                  key={i}
                  href={`/communities/${community.slug}`}
                  className="px-3 py-1 bg-stone-100 hover:bg-stone-200 rounded-full text-sm text-stone-700 transition-colors"
                >
                  {community.name}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Admin panel — platform staff only */}
      {isStaff && (
        <div className="mt-8 border border-amber-200 rounded-lg p-4 bg-amber-50">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Admin info</p>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-stone-500 w-24 flex-shrink-0">Email</dt>
              <dd className="text-stone-800 font-mono">{profileEmail ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-stone-500 w-24 flex-shrink-0">Joined</dt>
              <dd className="text-stone-800">{joinedFull}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-stone-500 w-24 flex-shrink-0">User ID</dt>
              <dd className="text-stone-500 font-mono text-xs">{profile.id}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
