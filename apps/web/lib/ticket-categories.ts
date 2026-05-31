import { createAdminClient } from '@/lib/supabase/admin'

export type TicketCategory = {
  key: string
  label: string
  position: number
  is_active: boolean
}

export async function getTicketCategories(): Promise<TicketCategory[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('ticket_categories')
    .select('key, label, position, is_active')
    .order('position')
  return data ?? []
}

export function buildCategoryLabels(categories: TicketCategory[]): Record<string, string> {
  return Object.fromEntries(categories.map(c => [c.key, c.label]))
}
