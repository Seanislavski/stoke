import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanKey } from '@/lib/billing'
import type Stripe from 'stripe'

function getPlanFromPriceId(priceId: string): PlanKey {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  return 'free'
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const admin = createAdminClient()
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id ?? ''
  const plan = subscription.status === 'canceled' ? 'free' : getPlanFromPriceId(priceId)

  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!sub) {
    console.error('[stripe webhook] Unknown customer:', customerId)
    return
  }

  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null

  await admin.from('subscriptions').upsert({
    user_id: sub.user_id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan,
    status: subscription.status,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotency — skip already-processed events
  const { data: existing } = await admin
    .from('stripe_webhook_events')
    .select('stripe_event_id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await admin
          .from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId)
        break
      }
    }
  } catch (err) {
    console.error('[stripe webhook] Error processing event:', event.type, err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  await admin.from('stripe_webhook_events').insert({ stripe_event_id: event.id })

  return NextResponse.json({ received: true })
}
