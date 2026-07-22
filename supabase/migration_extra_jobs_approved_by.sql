-- =============================================================================
-- Earthcare Landscapes — Migration: extra job "approved by" tracking
-- Free text, not a profiles FK — approval sometimes comes from an external
-- developer's own contact rather than a user in the system. Finance needs to
-- know who approved an extra job (and by extension, which entity to invoice).
-- Safe to run multiple times.
-- =============================================================================

ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS approved_by_name text;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
