import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleRow } = await supabase
    .from('platform_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!roleRow) redirect('/home')

  return (
    <div>
      <AdminNav role={roleRow.role} />
      {children}
    </div>
  )
}
