import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/home')

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Nav */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <StokeWordmark iconSize={28} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 leading-tight max-w-3xl mx-auto">
          A place where everyone has something to offer
        </h1>
        <p className="mt-5 text-lg text-stone-600 max-w-xl mx-auto leading-relaxed">
          Stoke helps you build communities where members genuinely give and receive — skills, time, knowledge, and support.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold text-base hover:bg-orange-600 transition-colors"
          >
            Start a community
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto bg-white border border-stone-300 text-stone-700 px-6 py-3 rounded-xl font-semibold text-base hover:bg-stone-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-stone-200">
            <div className="text-3xl mb-3">🌱</div>
            <h3 className="font-semibold text-stone-900 text-lg mb-2">Build your community</h3>
            <p className="text-stone-500 text-sm leading-relaxed">
              Create a space for your group, neighborhood, or interest. You set the rules, the vibe, and who gets in.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-stone-200">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="font-semibold text-stone-900 text-lg mb-2">Connect and collaborate</h3>
            <p className="text-stone-500 text-sm leading-relaxed">
              Channels, a bulletin board, events, and a shared resource library — everything your community actually needs.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-stone-200">
            <div className="text-3xl mb-3">🔄</div>
            <h3 className="font-semibold text-stone-900 text-lg mb-2">Give and receive</h3>
            <p className="text-stone-500 text-sm leading-relaxed">
              Real communities thrive when members contribute to each other. Stoke makes it easy to share what you know.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-orange-500 py-16">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to stoke something?</h2>
          <p className="text-orange-100 mb-6 text-base">
            Join or start a community where everyone has a role to play.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-orange-600 font-semibold px-6 py-3 rounded-xl hover:bg-orange-50 transition-colors"
          >
            Create a free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 text-center text-sm text-stone-400">
        © {new Date().getFullYear()} Stoke Community
      </footer>
    </div>
  )
}
