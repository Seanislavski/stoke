import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import BulkAddMembers from '@/components/community/BulkAddMembers'

export default async function BulkAddPage({
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
    .select('id, name, slug, owner_id')
    .eq('slug', slug)
    .single()

  if (!community) notFound()

  const admin = createAdminClient()
  const isOwner = user.id === community.owner_id

  const [{ data: platformRole }, { data: membership }] = await Promise.all([
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
    admin.from('community_members').select('role').eq('community_id', community.id).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ])

  const isStaff = isOwner || !!platformRole || membership?.role === 'organizer'
  if (!isStaff) redirect(`/communities/${slug}`)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/communities/${slug}/settings`} className="text-sm text-orange-600 hover:underline">
        ← Back to settings
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-stone-900">Bulk-add members</h1>
      <p className="mt-1 text-sm text-stone-500">
        Create accounts and add people to <span className="font-medium text-stone-700">{community.name}</span> in one
        step — great for onboarding a group in person. Each new account is ready to use immediately; existing accounts
        are simply added to the community.
      </p>

      <div className="mt-6">
        <BulkAddMembers communityId={community.id} slug={slug} communityName={community.name} />
      </div>
    </div>
  )
}
