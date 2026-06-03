import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PLANS, type PlanKey } from '@/lib/billing'
import BillingPanel from '@/components/settings/BillingPanel'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: sub }, { count: communityCount }] = await Promise.all([
    admin.from('subscriptions').select('plan, status, current_period_end, cancel_at_period_end').eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('*', { count: 'exact', head: true }).eq('owner_id', user.id),
  ])

  const plan: PlanKey = (sub?.plan as PlanKey) in PLANS ? (sub?.plan as PlanKey) : 'free'
  const planInfo = PLANS[plan]
  const isPaid = plan !== 'free' && sub?.status !== 'canceled'
  // Infinity is not JSON-serializable; pass null to mean "unlimited"
  const maxCommunities = planInfo.maxCommunities === Infinity ? null : planInfo.maxCommunities

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-stone-900">Billing</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your plan and billing.</p>
      </div>
      <BillingPanel
        plan={plan}
        planName={planInfo.name}
        planPrice={planInfo.price}
        maxCommunities={maxCommunities}
        communityCount={communityCount ?? 0}
        isPaid={isPaid}
        periodEnd={sub?.current_period_end ?? null}
        cancelAtPeriodEnd={sub?.cancel_at_period_end ?? false}
        status={sub?.status ?? 'active'}
      />
    </div>
  )
}
