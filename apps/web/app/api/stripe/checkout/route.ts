import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await request.json() as { plan: string }
  const priceId = PRICE_IDS[plan]
  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  // Already has an active subscription — send to portal to change plans
  if (sub?.stripe_subscription_id) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id!,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/settings/billing`,
    })
    return NextResponse.json({ url: portal.url })
  }

  let customerId = sub?.stripe_customer_id

  if (!customerId) {
    const { data: authUser } = await admin.auth.admin.getUserById(user.id)
    const customer = await stripe.customers.create({
      email: authUser.user?.email,
      metadata: { user_id: user.id },
    })
    customerId = customer.id

    // Store customer ID before checkout so webhook can look up the user
    await admin.from('subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      plan: 'free',
      status: 'active',
    }, { onConflict: 'user_id' })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/billing?success=1`,
      cancel_url: `${origin}/settings/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe checkout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
