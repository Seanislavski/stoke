import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: community } = await supabase
    .from('communities')
    .select('id, name, description, join_mode, is_listed')
    .eq('slug', slug)
    .single()

  if (!community) notFound()

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-semibold text-stone-900">{community.name}</h1>
      {community.description && (
        <p className="mt-2 text-stone-500">{community.description}</p>
      )}
      <p className="mt-6 text-stone-400 text-sm">Community page coming soon.</p>
    </div>
  )
}
