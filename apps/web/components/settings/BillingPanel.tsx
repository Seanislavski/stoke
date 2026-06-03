'use client'

import { useState } from 'react'

type Props = {
  plan: string
  planName: string
  planPrice: number
  maxCommunities: number | null
  communityCount: number
  isPaid: boolean
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  status: string
}

export default function BillingPanel({
  plan,
  planName,
  planPrice,
  maxCommunities,
  communityCount,
  isPaid,
  periodEnd,
  cancelAtPeriodEnd,
  status,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(targetPlan: string) {
    setLoading(targetPlan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  async function handleManage() {
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  const periodEndDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const planColor =
    plan === 'pro' ? 'bg-purple-100 text-purple-700' :
    plan === 'starter' ? 'bg-orange-100 text-orange-700' :
    'bg-stone-100 text-stone-600'

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planColor}`}>
                {planName}
              </span>
              {status === 'past_due' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  Payment past due
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-stone-900 mt-2">
              {planPrice === 0 ? 'Free forever' : `$${planPrice}/mo`}
            </p>
            {periodEndDate && (
              <p className="text-sm text-stone-500 mt-1">
                {cancelAtPeriodEnd ? `Cancels ${periodEndDate}` : `Renews ${periodEndDate}`}
              </p>
            )}
          </div>
          {isPaid && (
            <button
              onClick={handleManage}
              disabled={!!loading}
              className="shrink-0 text-sm text-stone-600 border border-stone-300 px-4 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              {loading === 'portal' ? 'Loading…' : 'Manage billing'}
            </button>
          )}
        </div>

        {/* Usage */}
        <div className="mt-4 pt-4 border-t border-stone-100">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Usage</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Communities owned</span>
            <span className="font-medium text-stone-900">
              {communityCount} / {maxCommunities === null ? '∞' : maxCommunities}
            </span>
          </div>
        </div>
      </div>

      {/* Upgrade options */}
      {plan !== 'pro' && (
        <div>
          <h2 className="text-base font-semibold text-stone-900 mb-3">Upgrade your plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plan === 'free' && (
              <PlanCard
                name="Starter"
                price={19}
                features={[
                  '3 communities',
                  '300 members per community',
                  '15 channels per community',
                  'Email notifications',
                  'Remove Stoke branding on invites',
                ]}
                loading={loading === 'starter'}
                onUpgrade={() => handleUpgrade('starter')}
              />
            )}
            <PlanCard
              name="Pro"
              price={49}
              highlight
              features={[
                'Unlimited communities',
                'Unlimited members',
                'Unlimited channels',
                'Priority support',
                'Everything in Starter',
              ]}
              loading={loading === 'pro'}
              onUpgrade={() => handleUpgrade('pro')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function PlanCard({
  name,
  price,
  features,
  loading,
  onUpgrade,
  highlight = false,
}: {
  name: string
  price: number
  features: string[]
  loading: boolean
  onUpgrade: () => void
  highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col ${highlight ? 'border-orange-300 bg-orange-50' : 'border-stone-200 bg-white'}`}>
      <div>
        <h3 className="font-semibold text-stone-900">{name}</h3>
        <p className="text-2xl font-bold text-stone-900 mt-1">
          ${price}<span className="text-sm font-normal text-stone-500">/mo</span>
        </p>
      </div>
      <ul className="mt-3 space-y-1.5 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-stone-600">
            <CheckIcon />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onUpgrade}
        disabled={loading}
        className={`mt-5 w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
          highlight
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-stone-900 text-white hover:bg-stone-700'
        }`}
      >
        {loading ? 'Loading…' : `Upgrade to ${name}`}
      </button>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  )
}
