-- Nested folders for cloud storage.

ALTER TABLE folders ADD COLUMN parent_folder_id TEXT;

CREATE INDEX IF NOT EXISTS folders_parent_folder_id_idx ON folders (parent_folder_id);
