-- =============================================================================
-- Earthcare Landscapes — Migration: checklist Yes/No items converted to checkboxes
-- Context: lw_edging_installed, lw_turf_installed, lw_steppers_installed,
-- lw_rock_installed, lw_tree_installed_pills used to be Yes/No items. The old
-- UI marked a row "completed" as soon as either Yes or No was answered, so
-- existing rows answered "No" are sitting with completed = true. Now that
-- these items render as plain checkboxes, reset those specific rows back to
-- unchecked so the checkbox reflects the real answer.
-- Removed items (e.g. lw_fine_grade, lw_irrigation_valve, etc.) are left as
-- orphaned rows untouched — no cleanup needed for those.
-- Safe to run multiple times.
-- =============================================================================

UPDATE lot_checklist_items
SET completed = false,
    completed_date = NULL
WHERE item_key IN (
  'lw_edging_installed',
  'lw_turf_installed',
  'lw_steppers_installed',
  'lw_rock_installed',
  'lw_tree_installed_pills'
)
AND response = 'no';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
