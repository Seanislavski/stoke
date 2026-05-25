import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-stone-900">You&apos;re in.</h1>
        <p className="mt-2 text-stone-500">Home page coming soon.</p>
      </div>
    </div>
  )
}
