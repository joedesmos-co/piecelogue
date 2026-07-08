-- Initial D1 schema for future cloud sync.
-- Note: This project is currently local-first; sync/auth are not implemented yet.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT,
  title TEXT NOT NULL,
  medium_type TEXT NOT NULL,
  medium TEXT,
  status TEXT NOT NULL,
  hours INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  artwork_date TEXT,
  notes TEXT,
  favorite INTEGER NOT NULL DEFAULT 0,
  original_object_key TEXT,
  thumbnail_object_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Indexes (to support future sync/query patterns)
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON folders (user_id);
CREATE INDEX IF NOT EXISTS folders_deleted_at_idx ON folders (deleted_at);

CREATE INDEX IF NOT EXISTS artworks_user_id_idx ON artworks (user_id);
CREATE INDEX IF NOT EXISTS artworks_folder_id_idx ON artworks (folder_id);
CREATE INDEX IF NOT EXISTS artworks_updated_at_idx ON artworks (updated_at);
CREATE INDEX IF NOT EXISTS artworks_deleted_at_idx ON artworks (deleted_at);

CREATE INDEX IF NOT EXISTS sync_events_user_id_idx ON sync_events (user_id);

