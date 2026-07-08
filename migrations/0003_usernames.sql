-- Reserved usernames/handles for future public sharing.

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN username_updated_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username))
WHERE username IS NOT NULL;
