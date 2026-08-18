-- =============================================================================
-- Earthcare Landscapes — Migration: attribution for lot activity + checklist
-- Adds "who" columns so the stage view's last-edited indicator can show a
-- name/initials for lot status changes and checklist ticks, not just quant
-- sheet saves (lot_quotes.last_edited_by) and photo uploads
-- (lot_photos.uploaded_by), which already carry attribution.
--
-- Only adds columns — existing rows have NULL here until next touched by
-- app code (a follow-up change, not part of this migration). No RLS changes
-- needed: existing UPDATE policies on these tables already cover all columns.
--
-- Safe to run multiple times.
-- =============================================================================

ALTER TABLE lots ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE lot_checklist_items ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
