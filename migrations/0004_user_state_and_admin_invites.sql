PRAGMA foreign_keys = ON;

-- One encrypted-by-access-control profile payload keeps the local app state
-- available on every device while the existing normalized tables remain intact.
CREATE TABLE IF NOT EXISTS user_states (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by_device TEXT,
  updated_by_label TEXT
);

-- New accounts can only be created with a short-lived, one-time admin invite
-- after the first owner account has been created.
CREATE TABLE IF NOT EXISTS admin_invites (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT,
  email TEXT,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_invites_hash ON admin_invites(code_hash);
