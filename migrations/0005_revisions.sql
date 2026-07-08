-- Revision tracking for multi-device conflict detection.

ALTER TABLE folders ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE artworks ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
