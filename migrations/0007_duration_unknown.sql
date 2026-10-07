-- Unknown artwork duration: explicit "Not sure" state.
--
-- WHY A MIGRATION IS REQUIRED: the artworks hours/minutes/total_minutes
-- columns are NOT NULL DEFAULT 0, so NULL cannot represent "unknown" without
-- a schema change. Instead of altering those columns (which would require a
-- table rebuild in D1), this adds an explicit duration_unknown flag.
-- Unknown rows keep hours/minutes/total_minutes at 0 in D1; the flag
-- preserves the semantic. Pre-flag rows default to 0 (known), so the
-- migration is fully backward compatible: old clients ignore the column and
-- keep seeing 0 minutes, new clients interpret the flag and store
-- null/unknown locally.

ALTER TABLE artworks ADD COLUMN duration_unknown INTEGER NOT NULL DEFAULT 0;
