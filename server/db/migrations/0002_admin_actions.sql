CREATE TABLE IF NOT EXISTS admin_actions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  action       TEXT NOT NULL,
  description  TEXT NOT NULL,
  payload      TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  approved_by  TEXT,
  created_at   TEXT NOT NULL,
  resolved_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_user_id ON admin_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_status ON admin_actions (status);
