import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import CommunityInfoForm from '@/components/community/settings/CommunityInfoForm'
import MembersManager from '@/components/community/settings/MembersManager'

export default async function CommunitySettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, slug, description, join_mode, is_listed, category_id, owner_id')
    .eq('slug', slug)
    .single()

  if (!community) notFound()

  const isOwner = user.id === community.owner_id
  const admin = createAdminClient()

  // Determine caller's role
  let callerRole: 'owner' | 'organizer' | 'moderator' | null = isOwner ? 'owner' : null
  if (!callerRole) {
    const { data: membership } = await admin
      .from('community_members')
      .select('role')
      .eq('community_id', community.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (membership?.role === 'organizer') callerRole = 'organizer'
    else if (membership?.role === 'moderator') callerRole = 'moderator'
  }

  if (!callerRole) redirect(`/communities/${slug}`)

  const [{ data: categories }, { data: members }] = await Promise.all([
    supabase.from('categories').select('id, name').order('name'),
    admin
      .from('community_members')
      .select('user_id, role, status, profiles(username, display_name)')
      .eq('community_id', community.id)
      .in('status', ['active', 'pending', 'banned'])
      .order('role'),
  ])

  const normalizedMembers = (members ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
  }))

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-10">
      <div className="flex items-center gap-3">
        <Link href={`/communities/${slug}`} className="text-sm text-stone-400 hover:text-stone-700">
          ← {community.name}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-stone-900">Community settings</h1>
        <p className="mt-1 text-sm text-stone-500 capitalize">Your role: {callerRole}</p>
      </div>

      {/* General info */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-4">General</h2>
        <CommunityInfoForm
          community={community}
          categories={categories ?? []}
        />
      </section>

      <hr className="border-stone-200" />

      {/* Members */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-4">Members</h2>
        <MembersManager
          communityId={community.id}
          slug={slug}
          callerRole={callerRole}
          callerId={user.id}
          initialMembers={normalizedMembers as Parameters<typeof MembersManager>[0]['initialMembers']}
        />
      </section>
    </div>
  )
}
