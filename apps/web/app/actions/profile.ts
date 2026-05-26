'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const display_name = formData.get('display_name') as string
  const bio = formData.get('bio') as string
  const show_memberships = formData.get('show_memberships') === 'on'

  const { error } = await supabase
    .from('profiles')
    .update({ display_name, bio, show_memberships })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/settings/profile')
  revalidatePath(`/profile`)
  return { success: true }
}
