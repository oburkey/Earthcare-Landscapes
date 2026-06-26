-- =============================================================================
-- Earthcare Landscapes — Migration: Merge "Corner lot" toggles
-- Gives the corner_lot_flag toggle a $375 price so it handles both visibility
-- control and the corner lot addition charge in one toggle.
-- The standalone "Corner lot addition" (show_if_corner_lot) is deactivated.
-- Existing lot_quote_items rows for that item are cleaned up automatically
-- the next time any affected quote is saved (save does delete-then-reinsert).
-- Safe to run multiple times.
-- =============================================================================

-- 1. Give the corner lot flag toggle the $375 addition price
UPDATE quote_template_items
SET unit_price = 375
WHERE auto_calc_formula = 'corner_lot_flag';

-- 2. Deactivate the now-redundant standalone "Corner lot addition" toggle
UPDATE quote_template_items
SET is_active = false
WHERE auto_calc_formula = 'show_if_corner_lot'
  AND name = 'Corner lot addition';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
