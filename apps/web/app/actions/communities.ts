'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkCommunityLimit } from '@/lib/billing'
import { logAction } from '@/lib/audit'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export async function createCommunity(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = (formData.get('name') as string).trim()
  const description = (formData.get('description') as string).trim()
  const joinMode = formData.get('join_mode') as string
  const categoryId = formData.get('category_id') as string
  const isListed = formData.get('is_listed') === 'true'

  if (!name || !joinMode || !categoryId) {
    return { error: 'Please fill in all required fields.' }
  }

  try {
    await checkCommunityLimit(user.id)
  } catch (e) {
    return { error: (e as Error).message }
  }

  // generate a unique slug
  const baseSlug = slugify(name)
  let slug = baseSlug
  let attempt = 0

  while (attempt < 5) {
    const { data: existing } = await supabase
      .from('communities')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    attempt++
    slug = `${baseSlug}-${Math.floor(Math.random() * 9000) + 1000}`
  }

  const { data: community, error } = await supabase
    .from('communities')
    .insert({
      name,
      slug,
      description: description || null,
      join_mode: joinMode,
      category_id: categoryId,
      is_listed: isListed,
      owner_id: user.id,
    })
    .select('id, slug')
    .single()

  if (error) {
    return { error: 'Something went wrong. Please try again.' }
  }

  await logAction({
    actorId: user.id,
    communityId: community.id,
    action: 'community.created',
    metadata: { name, slug: community.slug, join_mode: joinMode, is_listed: isListed },
  })

  redirect(`/communities/${community.slug}`)
}
