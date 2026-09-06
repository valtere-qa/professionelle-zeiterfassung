ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN verification_token_hash TEXT;
ALTER TABLE users ADD COLUMN verification_expires_at TEXT;
ALTER TABLE users ADD COLUMN verification_sent_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token_hash);