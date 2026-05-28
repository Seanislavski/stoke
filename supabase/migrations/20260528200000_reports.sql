CREATE TABLE reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit reports (not on themselves)
CREATE POLICY "users_insert_reports" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND reported_user_id <> auth.uid());

-- Reporters can see their own reports
CREATE POLICY "reporters_read_own" ON reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- Community mods can read reports for their community
CREATE POLICY "mods_read_community_reports" ON reports
  FOR SELECT TO authenticated
  USING (
    community_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = reports.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.status = 'active'
        AND community_members.role IN ('organizer', 'moderator')
    )
  );

-- Platform staff can read all reports
CREATE POLICY "platform_staff_read_reports" ON reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM platform_roles
      WHERE platform_roles.user_id = auth.uid()
        AND platform_roles.role IN ('owner', 'platform_moderator')
    )
  );

-- Platform staff can update all reports
CREATE POLICY "platform_staff_update_reports" ON reports
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM platform_roles
      WHERE platform_roles.user_id = auth.uid()
        AND platform_roles.role IN ('owner', 'platform_moderator')
    )
  );

-- Community mods can update reports for their community
CREATE POLICY "mods_update_community_reports" ON reports
  FOR UPDATE TO authenticated
  USING (
    community_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = reports.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.status = 'active'
        AND community_members.role IN ('organizer', 'moderator')
    )
  );

CREATE INDEX reports_community_status ON reports (community_id, status, created_at DESC);
CREATE INDEX reports_status ON reports (status, created_at DESC) WHERE community_id IS NULL;
