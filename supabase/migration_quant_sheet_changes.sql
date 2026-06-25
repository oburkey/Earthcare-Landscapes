-- =============================================================================
-- Earthcare Landscapes — Migration: Quant Sheet Changes
-- 1. Irrigation items → ITEM type (always included, no toggle)
-- 2. Tree size variant toggles (90L/75L, 45L/30L)
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times.
-- =============================================================================


-- ── 1. Irrigation items: toggle → ITEM ───────────────────────────────────────

UPDATE quote_template_items SET unit = 'ITEM'
WHERE name IN (
  'Dripper Irrigation front',
  'Solenoid / Plumber cut in',
  'Pre-lay and cables',
  'Controller and cables',
  'Rear & Side Irrigation'
) AND unit = 'toggle';


-- ── 2. Tree variant groups ───────────────────────────────────────────────────

-- Set variant_group on existing 90L and 45L items
UPDATE quote_template_items
SET auto_calc_formula = 'variant_group:front_large_trees'
WHERE name = 'Feature Trees 90L' AND auto_calc_formula IS NULL;

UPDATE quote_template_items
SET auto_calc_formula = 'variant_group:front_small_trees'
WHERE name = 'Feature Trees 45L' AND auto_calc_formula IS NULL;

-- Insert 75L (paired with 90L in the large tree variant group)
INSERT INTO quote_template_items (section_id, name, unit, unit_price, plant_category, auto_calc_formula, order_index)
SELECT section_id, 'Feature Trees 75L', 'No.', 465.00, 'front', 'variant_group:front_large_trees', order_index + 1
FROM quote_template_items WHERE name = 'Feature Trees 90L'
AND NOT EXISTS (SELECT 1 FROM quote_template_items WHERE name = 'Feature Trees 75L');

-- Insert 30L (paired with 45L in the small tree variant group)
INSERT INTO quote_template_items (section_id, name, unit, unit_price, plant_category, auto_calc_formula, order_index)
SELECT section_id, 'Feature Trees 30L', 'No.', 245.00, 'front', 'variant_group:front_small_trees', order_index + 1
FROM quote_template_items WHERE name = 'Feature Trees 45L'
AND NOT EXISTS (SELECT 1 FROM quote_template_items WHERE name = 'Feature Trees 30L');


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
