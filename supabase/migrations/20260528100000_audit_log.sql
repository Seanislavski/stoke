CREATE TABLE audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  actor_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  target_id text,
  target_type text,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX audit_log_community_created ON audit_log(community_id, created_at DESC);
CREATE INDEX audit_log_created ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Community organizers and moderators can read their community's log
CREATE POLICY "mods_read_community_audit_log" ON audit_log
  FOR SELECT USING (
    community_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = audit_log.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('organizer', 'moderator')
        AND cm.status = 'active'
    )
  );

-- Platform owners and moderators can read all entries
CREATE POLICY "platform_staff_read_audit_log" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_roles pr
      WHERE pr.user_id = auth.uid()
        AND pr.role IN ('owner', 'platform_moderator')
    )
  );
