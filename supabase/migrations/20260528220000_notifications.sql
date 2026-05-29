CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  message_id text,
  read_at timestamptz
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX notifications_user_unread ON notifications (user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX notifications_user_created ON notifications (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
