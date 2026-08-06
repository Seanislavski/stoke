import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ChooseUsernameForm from '@/components/settings/ChooseUsernameForm'

// Shown once, to members whose username was derived for them rather than typed
// (Discord sign-in). Everyone else is redirected straight through, so this can
// never become a rename page.
export default async function ChooseUsernamePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next: nextParam } = await searchParams
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/home'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('username, username_chosen, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/login')
  if (profile.username_chosen) redirect(next)

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <div className="bg-white border border-stone-200 rounded-xl p-8 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            Welcome{profile.display_name ? `, ${profile.display_name}` : ''} 👋
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Pick the username people will see on Stoke. We&apos;ve suggested one based on your
            Discord account — keep it or change it now.
          </p>
        </div>
        <ChooseUsernameForm suggested={profile.username} next={next} />
      </div>
    </div>
  )
}
