import { createAdminClient } from '@/lib/supabase/admin'

export const PLANS = {
  free:    { name: 'Free',    price: 0,  maxCommunities: 1,        maxMembers: 50,       maxChannels: 3        },
  starter: { name: 'Starter', price: 19, maxCommunities: 3,        maxMembers: 300,      maxChannels: 15       },
  pro:     { name: 'Pro',     price: 49, maxCommunities: Infinity, maxMembers: Infinity, maxChannels: Infinity },
} as const

export type PlanKey = keyof typeof PLANS

export async function getUserPlan(userId: string): Promise<PlanKey> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data || data.status === 'canceled') return 'free'
  const plan = data.plan as PlanKey
  return plan in PLANS ? plan : 'free'
}

export async function getCommunityOwnerPlan(communityId: string): Promise<PlanKey> {
  const admin = createAdminClient()
  const { data: community } = await admin
    .from('communities')
    .select('owner_id')
    .eq('id', communityId)
    .single()

  if (!community) return 'free'
  return getUserPlan(community.owner_id)
}

export async function checkCommunityLimit(userId: string): Promise<void> {
  const admin = createAdminClient()
  const [plan, { count }] = await Promise.all([
    getUserPlan(userId),
    admin.from('communities').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
  ])

  const limit = PLANS[plan].maxCommunities
  if ((count ?? 0) >= limit) {
    throw new Error(
      `You've reached the ${PLANS[plan].name} plan limit of ${limit} ${limit === 1 ? 'community' : 'communities'}. Upgrade your plan to create more.`
    )
  }
}

export async function checkMemberLimit(communityId: string): Promise<void> {
  const admin = createAdminClient()
  const [plan, { count }] = await Promise.all([
    getCommunityOwnerPlan(communityId),
    admin.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'active'),
  ])

  const limit = PLANS[plan].maxMembers
  if ((count ?? 0) >= limit) {
    throw new Error(
      `This community has reached its member limit (${limit}). The organizer needs to upgrade their plan to accept more members.`
    )
  }
}

export async function checkChannelLimit(communityId: string): Promise<void> {
  const admin = createAdminClient()
  const [plan, { count }] = await Promise.all([
    getCommunityOwnerPlan(communityId),
    admin.from('channels').select('*', { count: 'exact', head: true }).eq('community_id', communityId),
  ])

  const limit = PLANS[plan].maxChannels
  if ((count ?? 0) >= limit) {
    throw new Error(
      `You've reached the channel limit for this plan (${limit} channels). Upgrade your plan to add more.`
    )
  }
}
