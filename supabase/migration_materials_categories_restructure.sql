-- =============================================================================
-- Earthcare Landscapes — Migration: Materials Orders category/unit restructure
-- Pot sizes become the primary order line item category (with a secondary
-- plant type/variety dropdown for plant sizes only); units become a fixed
-- dropdown shared between order line items and material conversion settings.
-- Safe to run multiple times.
-- =============================================================================

-- ── site_stock: new pot size columns ────────────────────────────────────────
ALTER TABLE site_stock ADD COLUMN IF NOT EXISTS plants_300mm int NOT NULL DEFAULT 0;
ALTER TABLE site_stock ADD COLUMN IF NOT EXISTS plants_35l   int NOT NULL DEFAULT 0;
ALTER TABLE site_stock ADD COLUMN IF NOT EXISTS plants_90l   int NOT NULL DEFAULT 0;

-- ── material_order_items: secondary plant type/variety (info only, not used
-- for stock — the primary `category` column now drives stock updates) ───────
ALTER TABLE material_order_items ADD COLUMN IF NOT EXISTS plant_type text;

-- ── material_order_items: drop the old category CHECK constraint ───────────
-- The old constraint only allowed the previous plant-type category list
-- (Small Shrubs, Trees, etc.) as the PRIMARY category. Categories are now pot
-- sizes / material types instead, and the list is expected to evolve (plant
-- type/variety options especially — see order-constants.ts), so category is
-- left as free text validated by the app's dropdown, same as `unit` already is.
ALTER TABLE material_order_items DROP CONSTRAINT IF EXISTS material_order_items_category_check;

-- ── material_conversion_settings: normalise existing unit values to match
-- the new fixed dropdown list (plants, tonnes, rolls, packs, linear metres
-- (lm), m², items, bags, pallets) so previously-seeded/entered rows still
-- show a valid selection instead of landing on the blank placeholder.
UPDATE material_conversion_settings SET unit_from = 'tonnes'              WHERE unit_from = 'tonne';
UPDATE material_conversion_settings SET unit_from = 'packs'               WHERE unit_from = 'pack';
UPDATE material_conversion_settings SET unit_from = 'rolls'               WHERE unit_from = 'roll';
UPDATE material_conversion_settings SET unit_to   = 'linear metres (lm)'  WHERE unit_to   = 'linear metres';
UPDATE material_conversion_settings SET unit_to   = 'items'               WHERE unit_to   = 'units';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
