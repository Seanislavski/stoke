import { createClient } from '@/lib/supabase/server'
import CreateCommunityForm from '@/components/CreateCommunityForm'

export default async function NewCommunityPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_approved', true)
    .order('name')

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Start a community</h1>
        <p className="mt-1 text-stone-500 text-sm">You&apos;ll be the organizer. You can change any of this later.</p>
      </div>
      <CreateCommunityForm categories={categories ?? []} />
    </div>
  )
}
