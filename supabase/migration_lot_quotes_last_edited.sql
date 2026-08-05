-- =============================================================================
-- Earthcare Landscapes — Migration: lot_quotes last edited tracking
-- Adds "who last saved this quant sheet, and when" so the lot detail page
-- can show a "Last edited by [name] · [date] at [time]" line (admin only).
-- Safe to run multiple times.
-- =============================================================================

ALTER TABLE lot_quotes ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE lot_quotes ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
