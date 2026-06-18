'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/home'
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    // If email confirmation is enabled, the confirmation link returns the user
    // to the auth callback, which then forwards them to `redirectTo`.
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: username }, emailRedirectTo },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // email already exists
    if (data.user?.identities?.length === 0) {
      setError('An account with this email already exists.')
      setLoading(false)
      return
    }

    // No session means email confirmation is required — show a "check your email"
    // state instead of pushing to a route the user can't yet access.
    if (!data.session) {
      setConfirmSent(true)
      setLoading(false)
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  if (confirmSent) {
    return (
      <div className="text-center">
        <div className="text-3xl mb-4">📨</div>
        <h1 className="text-2xl font-semibold text-stone-900">Check your email</h1>
        <p className="mt-2 text-stone-500 text-sm">
          We sent a confirmation link to <span className="font-medium text-stone-700">{email}</span>.
          Click it to finish setting up your account.
        </p>
        <p className="mt-6 text-sm text-stone-400">
          Wrong address?{' '}
          <button
            type="button"
            onClick={() => { setConfirmSent(false); setError('') }}
            className="text-orange-600 hover:underline font-medium"
          >
            Go back
          </button>
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-stone-900">Create your account</h1>
        <p className="mt-1 text-stone-500 text-sm">Join Stoke and find your community</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-stone-700 mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            title="Letters, numbers, and underscores only"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-stone-400">At least 8 characters</p>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-500">
        Already have an account?{' '}
        <Link
          href={redirectTo !== '/home' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
          className="text-orange-600 hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </>
  )
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-stone-50">
      <div className="w-full max-w-sm">
        <Suspense>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  )
}
