-- =============================================================================
-- Earthcare Landscapes — Migration: corner lot flag on lots
-- Adds a persistent "is this a corner lot" flag on the lot itself, editable
-- from the Edit Lot form (supervisor/admin only). Distinct from the existing
-- quant-sheet-level "Corner lot" toggle item (quote_template_items, feeds
-- show_if_corner_lot auto-calcs) — that one lives per quant sheet save and
-- can differ between estimate/budget/final; this one is a stable lot
-- attribute, e.g. used in the stage estimate Excel export's Notes column.
--
-- No RLS changes needed — existing UPDATE policies on lots already cover
-- all columns.
--
-- Safe to run multiple times.
-- =============================================================================

ALTER TABLE lots ADD COLUMN IF NOT EXISTS is_corner boolean NOT NULL DEFAULT false;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
