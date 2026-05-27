import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import ChannelView from '@/components/channel/ChannelView'

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string; channelId: string }>
}) {
  const { slug, channelId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // verify channel exists and belongs to this community
  const { data: channel } = await admin
    .from('channels')
    .select('id, name, community_id, communities(slug)')
    .eq('id', channelId)
    .single()

  if (!channel) notFound()

  const communitySlug = Array.isArray(channel.communities)
    ? channel.communities[0]?.slug
    : (channel.communities as { slug: string } | null)?.slug

  if (communitySlug !== slug) notFound()

  // verify user is active member
  const { data: membership } = await admin
    .from('community_members')
    .select('status')
    .eq('community_id', channel.community_id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isOwner = await admin
    .from('communities')
    .select('owner_id')
    .eq('id', channel.community_id)
    .single()
    .then(({ data }) => data?.owner_id === user.id)

  if (membership?.status !== 'active' && !isOwner) {
    redirect(`/communities/${slug}`)
  }

  // load last 50 messages
  const { data: messages } = await admin
    .from('messages')
    .select('id, content, created_at, edited_at, author_id, profiles(username, display_name, avatar_url)')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(50)

  const normalizedMessages = (messages ?? []).map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
  }))

  // build profile cache for client
  const profileCache: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {}
  for (const m of normalizedMessages) {
    if (m.profiles && m.author_id) {
      profileCache[m.author_id] = m.profiles
    }
  }

  return (
    <ChannelView
      channelId={channelId}
      channelName={channel.name}
      communitySlug={slug}
      currentUserId={user.id}
      initialMessages={normalizedMessages as Parameters<typeof ChannelView>[0]['initialMessages']}
      initialProfiles={profileCache}
    />
  )
}
