import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import ChannelView from '@/components/channel/ChannelView'

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; channelId: string }>
  searchParams: Promise<{ message?: string; mention?: string }>
}) {
  const { slug, channelId } = await params
  const { message: highlightMessageId, mention: mentionMessageId } = await searchParams
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
  const [{ data: membership }, { data: community }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('status, role').eq('community_id', channel.community_id).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', channel.community_id).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ])

  const isOwner = community?.owner_id === user.id
  const isPlatformStaff = ['owner', 'platform_moderator'].includes(platformRole?.role ?? '')

  if (membership?.status !== 'active' && !isOwner && !isPlatformStaff) {
    redirect(`/communities/${slug}`)
  }

  const isMod = isOwner || isPlatformStaff || (membership?.status === 'active' && ['organizer', 'moderator'].includes(membership.role ?? ''))

  // load last 50 messages — mods see deleted ones too
  let messagesQuery = admin
    .from('messages')
    .select('id, content, image_url, created_at, edited_at, previous_content, author_id, deleted_at, deleted_by, profiles!author_id(username, display_name, avatar_url)')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!isMod) messagesQuery = messagesQuery.is('deleted_at', null)

  const { data: messages } = await messagesQuery

  const normalizedMessages = (messages ?? []).reverse().map(m => ({
    ...m,
    profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
  }))

  // load reactions for the visible messages
  const messageIds = normalizedMessages.map(m => m.id)
  const { data: reactionRows } = messageIds.length
    ? await admin.from('message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds)
    : { data: [] as { message_id: string; user_id: string; emoji: string }[] }

  // build profile cache for client
  const profileCache: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {}
  for (const m of normalizedMessages) {
    if (m.profiles && m.author_id) {
      profileCache[m.author_id] = m.profiles
    }
  }

  // ensure current user's profile is always in cache (needed for optimistic messages)
  if (!profileCache[user.id]) {
    const { data: myProfile } = await admin
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', user.id)
      .single()
    if (myProfile) profileCache[user.id] = myProfile
  }

  return (
    <ChannelView
      channelId={channelId}
      channelName={channel.name}
      communityId={channel.community_id}
      communitySlug={slug}
      currentUserId={user.id}
      isMod={isMod}
      initialMessages={normalizedMessages as Parameters<typeof ChannelView>[0]['initialMessages']}
      initialProfiles={profileCache}
      initialReactions={reactionRows ?? []}
      highlightMessageId={highlightMessageId}
      mentionMessageId={mentionMessageId}
    />
  )
}
