-- =============================================================================
-- Earthcare Landscapes — Migration: plant_ratio_settings table
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS and DROP IF EXISTS throughout.
-- =============================================================================


-- ── 1. New table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plant_ratio_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid REFERENCES sites(id) ON DELETE CASCADE,
  front_ratio     numeric NOT NULL DEFAULT 2.0,
  rear_ratio      numeric NOT NULL DEFAULT 1.75,
  pot_size_split  jsonb NOT NULL DEFAULT '{"130mm": 75, "200mm": 25}',
  updated_by      uuid REFERENCES profiles(id),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Only one row per site...
CREATE UNIQUE INDEX IF NOT EXISTS plant_ratio_settings_site_id_unique
  ON plant_ratio_settings (site_id) WHERE site_id IS NOT NULL;

-- ...and only one global default row (site_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS plant_ratio_settings_global_unique
  ON plant_ratio_settings ((true)) WHERE site_id IS NULL;

DROP TRIGGER IF EXISTS plant_ratio_settings_updated_at ON plant_ratio_settings;
CREATE TRIGGER plant_ratio_settings_updated_at
  BEFORE UPDATE ON plant_ratio_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE plant_ratio_settings ENABLE ROW LEVEL SECURITY;


-- ── 3. RLS policies ───────────────────────────────────────────────────────────

-- All staff can read plant ratio settings (used in quote/quantity calculations)
DROP POLICY IF EXISTS "plant_ratio_settings: staff read all" ON plant_ratio_settings;
CREATE POLICY "plant_ratio_settings: staff read all"
  ON plant_ratio_settings FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Only admins can create/update/delete
DROP POLICY IF EXISTS "plant_ratio_settings: admin write" ON plant_ratio_settings;
CREATE POLICY "plant_ratio_settings: admin write"
  ON plant_ratio_settings FOR ALL
  USING (current_user_role() = 'admin');


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
