-- =============================================================================
-- Earthcare Landscapes — Migration: Materials conversion linked materials
-- Adds an optional "linked materials" concept to material_conversion_settings —
-- secondary materials (e.g. Crackerdust, Turf pegs, Turf sand under Turf) that
-- get suggested in the Orders tab and can bump their own site_stock column on
-- delivery. Also adds a per-line-item stock_field override so those
-- suggestion-added line items can drive stock without matching on category.
-- Safe to run multiple times.
-- =============================================================================

-- ── material_order_items: explicit stock-field override ─────────────────────
-- Plain text snapshot (not an FK to material_conversion_links), same
-- free-text-validated-by-the-app approach already used for `category` and
-- `unit` on this table. NULL for ordinary category-driven items (unchanged
-- behaviour); set explicitly to a site_stock column name when a line item is
-- added from a linked-materials suggestion in the Orders tab.
ALTER TABLE material_order_items ADD COLUMN IF NOT EXISTS stock_field text;

-- ── material_conversion_links ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_conversion_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_setting_id uuid NOT NULL REFERENCES material_conversion_settings(id) ON DELETE CASCADE,
  name              text NOT NULL,
  rate              numeric NOT NULL,
  unit              text NOT NULL,
  stock_field       text,
  order_index       int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE material_conversion_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_conversion_links: all staff read" ON material_conversion_links;
CREATE POLICY "material_conversion_links: all staff read"
  ON material_conversion_links FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_conversion_links: admin write" ON material_conversion_links;
CREATE POLICY "material_conversion_links: admin write"
  ON material_conversion_links FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- ── Seed: Turf linked materials ──────────────────────────────────────────────
-- Matched by conversion setting name (not a hardcoded id) and idempotent via
-- NOT EXISTS keyed on (parent_setting_id, name), so re-running this is safe
-- even if an admin has already added/edited these rows by hand.
INSERT INTO material_conversion_links (parent_setting_id, name, rate, unit, stock_field, order_index)
SELECT mcs.id, v.name, v.rate, v.unit, v.stock_field, v.order_index
FROM material_conversion_settings mcs
CROSS JOIN (VALUES
  ('Crackerdust', 0.075, 'm³',     NULL::text, 1),
  ('Turf pegs',   12,    'items',  NULL::text, 2),
  ('Turf sand',   0.01,  'tonnes', NULL::text, 3)
) AS v(name, rate, unit, stock_field, order_index)
WHERE mcs.name = 'Turf'
AND NOT EXISTS (
  SELECT 1 FROM material_conversion_links l
  WHERE l.parent_setting_id = mcs.id AND l.name = v.name
);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
