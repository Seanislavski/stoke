import { createAdminClient } from '@/lib/supabase/admin'
import AuditLogClient from '@/components/admin/AuditLogClient'

export default async function AdminAuditLogPage() {
  const admin = createAdminClient()

  const { data: entries } = await admin
    .from('audit_log')
    .select('id, created_at, action, community_id, target_user_id, target_id, target_type, metadata, actor:actor_id(username, display_name), target_user:target_user_id(username, display_name), community:community_id(name, slug)')
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900 mb-6">Audit Log</h1>
      {!entries || entries.length === 0 ? (
        <p className="text-sm text-stone-400">No actions logged yet.</p>
      ) : (
        <AuditLogClient entries={entries as unknown as Parameters<typeof AuditLogClient>[0]['entries']} />
      )}
    </div>
  )
}
