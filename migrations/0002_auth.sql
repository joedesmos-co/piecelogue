-- Auth foundation: magic links and opaque server-side sessions.

ALTER TABLE users ADD COLUMN email_verified_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS auth_magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS auth_magic_links_token_hash_idx ON auth_magic_links (token_hash);
CREATE INDEX IF NOT EXISTS auth_magic_links_email_idx ON auth_magic_links (email);
CREATE INDEX IF NOT EXISTS auth_magic_links_expires_at_idx ON auth_magic_links (expires_at);
CREATE INDEX IF NOT EXISTS auth_magic_links_email_pending_idx ON auth_magic_links (email, consumed_at, expires_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS auth_sessions_token_hash_idx ON auth_sessions (token_hash);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS auth_sessions_active_idx ON auth_sessions (token_hash, revoked_at, expires_at);
