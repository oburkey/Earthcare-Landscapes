-- =============================================================================
-- Earthcare Landscapes — Migration: Flexible materials stock system
-- Replaces the fixed-column site_stock table with material_types (an
-- admin-editable master list of trackable materials) + site_stock_items
-- (one row per site x material). Safe to run multiple times.
-- =============================================================================

-- ── material_types: master list of trackable materials ──────────────────────
CREATE TABLE IF NOT EXISTS material_types (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  unit                   text NOT NULL,
  stock_group            text NOT NULL CHECK (stock_group IN ('Plants', 'Mulch', 'Hardscape', 'Retic')),
  quant_item_names       text[] NOT NULL DEFAULT '{}',
  conversion_setting_id  uuid REFERENCES material_conversion_settings(id) ON DELETE SET NULL,
  is_active              boolean NOT NULL DEFAULT true,
  order_index            int NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE material_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_types: all staff read" ON material_types;
CREATE POLICY "material_types: all staff read"
  ON material_types FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_types: admin write" ON material_types;
CREATE POLICY "material_types: admin write"
  ON material_types FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- ── site_stock_items: one row per site x material ────────────────────────────
CREATE TABLE IF NOT EXISTS site_stock_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  material_type_id    uuid NOT NULL REFERENCES material_types(id) ON DELETE CASCADE,
  quantity            numeric(10,3) NOT NULL DEFAULT 0,
  last_updated_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_update_source  text, -- 'manual' | 'order_delivery' | 'quant_deduction'
  last_update_lot     text, -- lot number, only set when last_update_source = 'quant_deduction'
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, material_type_id)
);

DROP TRIGGER IF EXISTS site_stock_items_updated_at ON site_stock_items;
CREATE TRIGGER site_stock_items_updated_at
  BEFORE UPDATE ON site_stock_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE site_stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_stock_items: all staff read" ON site_stock_items;
CREATE POLICY "site_stock_items: all staff read"
  ON site_stock_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "site_stock_items: leading_hand+ insert" ON site_stock_items;
CREATE POLICY "site_stock_items: leading_hand+ insert"
  ON site_stock_items FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "site_stock_items: leading_hand+ update" ON site_stock_items;
CREATE POLICY "site_stock_items: leading_hand+ update"
  ON site_stock_items FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- ── Seed material_types ───────────────────────────────────────────────────────
-- Idempotent — keyed on name, so re-running this after an admin has edited
-- rows won't duplicate or reset them.
INSERT INTO material_types (name, unit, stock_group, quant_item_names, order_index)
SELECT * FROM (VALUES
  -- Plants
  ('130/140mm plants', 'plants', 'Plants', ARRAY['130/140mm plants'],                        0),
  ('200mm plants',     'plants', 'Plants', ARRAY['200mm plants'],                             1),
  ('300mm plants',     'plants', 'Plants', ARRAY['300mm plants'],                             2),
  ('Feature Trees 90L','plants', 'Plants', ARRAY['Feature Trees 90L'],                        3),
  ('Feature Trees 75L','plants', 'Plants', ARRAY['Feature Trees 75L'],                        4),
  ('Feature Trees 45L','plants', 'Plants', ARRAY['Feature Trees 45L'],                        5),
  ('Feature Trees 30L','plants', 'Plants', ARRAY['Feature Trees 30L'],                        6),
  ('Feature Tree 10L', 'plants', 'Plants', ARRAY['Feature Tree 10L'],                         7),
  ('Small Trees',      'plants', 'Plants', ARRAY['Small Trees'],                              8),
  ('Fruit Trees',      'plants', 'Plants', ARRAY['Fruit Trees'],                              9),
  -- Mulch
  ('Limestone Mulch',  'm²',     'Mulch',     ARRAY['Mulch Limestone 32mm', 'Limestone Mulch'],   0),
  ('Black Mulch',      'm²',     'Mulch',     ARRAY['Black Mulch'],                               1),
  ('Laterite',         'm²',     'Mulch',     ARRAY['Laterite compacted gravel', 'Laterite Gravel Mulch'], 2),
  ('Recycled Brick',   'm²',     'Mulch',     ARRAY['Recycled Brick'],                            3),
  ('Crackerdust',      'm²',     'Mulch',     ARRAY[]::text[],                                    4),
  -- Hardscape
  ('Turf',                 'rolls', 'Hardscape', ARRAY['Artificial Turf', 'Artificial turf rear'], 0),
  ('Edging',                'lm',    'Hardscape', ARRAY['Steel Edging', 'Edging'],                  1),
  ('Steppers 600×400mm',    'items', 'Hardscape', ARRAY['Steppers 600×400mm'],                      2),
  ('Steppers 400×400mm',    'items', 'Hardscape', ARRAY['Steppers 400×400mm'],                      3),
  -- Retic
  ('Drippers',  'packs', 'Retic', ARRAY[]::text[], 0),
  ('Jabs',      'packs', 'Retic', ARRAY[]::text[], 1),
  ('Poly Pipe', 'rolls', 'Retic', ARRAY[]::text[], 2)
) AS v(name, unit, stock_group, quant_item_names, order_index)
WHERE NOT EXISTS (SELECT 1 FROM material_types mt WHERE mt.name = v.name);

-- Auto-wire each material type's conversion rate to any material_conversion_settings
-- row with the exact same name (Turf -> rolls-per-m²; Drippers -> units-per-pack,
-- if a 'Drippers' conversion setting exists; etc.) — matched by name rather
-- than hardcoded ids, and only when not already set, so this never clobbers
-- an admin's later manual change.
UPDATE material_types mt
SET conversion_setting_id = mcs.id
FROM material_conversion_settings mcs
WHERE mcs.name = mt.name AND mt.conversion_setting_id IS NULL;

-- ── Migrate existing site_stock data into site_stock_items ──────────────────
-- Guarded so this whole block is a no-op if site_stock has already been
-- dropped (i.e. this migration has already been run once).
-- NOTE: mulch_tonnes -> 'Limestone Mulch' copies the raw number across
-- unconverted even though mulch_tonnes was recorded in tonnes and Limestone
-- Mulch's unit is m² — this is a "best guess" per spec; an admin needs to
-- correct the actual value (not just the label) after this migration runs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_stock') THEN

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.plants_140mm, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = '130/140mm plants'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.plants_200mm, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = '200mm plants'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.plants_300mm, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = '300mm plants'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.plants_35l, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = 'Feature Trees 45L'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.plants_90l, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = 'Feature Trees 90L'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.mulch_tonnes, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = 'Limestone Mulch'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.edging_metres, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = 'Edging'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.turf_rolls, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = 'Turf'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

    INSERT INTO site_stock_items (site_id, material_type_id, quantity, last_updated_by, updated_at)
    SELECT ss.site_id, mt.id, ss.drippers_packs, ss.last_updated_by, ss.updated_at
    FROM site_stock ss JOIN material_types mt ON mt.name = 'Drippers'
    ON CONFLICT (site_id, material_type_id) DO NOTHING;

  END IF;
END $$;

-- ── Drop the old fixed-column table ──────────────────────────────────────────
-- Irreversible. Verify the site_stock_items migration above looks correct
-- (especially the Limestone Mulch tonnes->m² note) before running this in
-- production if you want a chance to double-check first.
DROP TABLE IF EXISTS site_stock;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
