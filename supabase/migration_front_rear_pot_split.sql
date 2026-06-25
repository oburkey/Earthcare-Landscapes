-- =============================================================================
-- Earthcare Landscapes — Migration: Front/Rear Pot Splits + Rename 5L → 200mm
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times.
-- =============================================================================


-- ── 1. Add front_pot_split and rear_pot_split to plant_ratio_settings ─────────

ALTER TABLE plant_ratio_settings ADD COLUMN IF NOT EXISTS front_pot_split jsonb;
ALTER TABLE plant_ratio_settings ADD COLUMN IF NOT EXISTS rear_pot_split jsonb;

UPDATE plant_ratio_settings
SET front_pot_split = COALESCE(front_pot_split, pot_size_split),
    rear_pot_split  = COALESCE(rear_pot_split, pot_size_split);

ALTER TABLE plant_ratio_settings
  ALTER COLUMN front_pot_split SET NOT NULL,
  ALTER COLUMN front_pot_split SET DEFAULT '{"130mm": 75, "200mm": 25}'::jsonb;

ALTER TABLE plant_ratio_settings
  ALTER COLUMN rear_pot_split SET NOT NULL,
  ALTER COLUMN rear_pot_split SET DEFAULT '{"130mm": 75, "200mm": 25}'::jsonb;


-- ── 2. Rename "5L plants" to "200mm plants" ──────────────────────────────────

UPDATE quote_template_items SET name = '200mm plants' WHERE name = '5L plants';
UPDATE lot_quote_items SET item_name = '200mm plants' WHERE item_name = '5L plants';


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
