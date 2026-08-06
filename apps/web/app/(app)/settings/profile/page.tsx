import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/settings/ProfileForm'
import LinkDiscord from '@/components/settings/LinkDiscord'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, show_memberships, timezone, discord_username, show_discord, discord_user_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-stone-900">Edit profile</h1>
        <p className="mt-1 text-sm text-stone-500">
          Update your public profile information.
        </p>
      </div>
      <ProfileForm profile={profile} />

      <div className="mt-10 max-w-lg border-t border-stone-200 pt-8">
        <h2 className="text-sm font-medium text-stone-700 mb-1">Discord account</h2>
        <p className="text-xs text-stone-400 mb-3">
          Connecting is separate from showing your username — you choose that above.
        </p>
        <LinkDiscord
          linked={!!profile.discord_user_id}
          handle={profile.discord_username}
        />
      </div>
    </div>
  )
}
