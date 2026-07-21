-- =============================================================================
-- Earthcare Landscapes — Migration: Materials page overhaul
-- Adds base ordering, per-site stock, and material conversion settings for
-- the new Orders / Stock / Settings tabs on the Materials page.
-- Safe to run multiple times.
-- =============================================================================

-- ── material_orders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  supplier_id     uuid REFERENCES contacts(id) ON DELETE SET NULL,
  order_date      date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   date,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'ordered', 'on_hold', 'delivered')),
  notes           text,
  invoice_amount  numeric(10,2),
  delivered_at    timestamptz,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS material_orders_updated_at ON material_orders;
CREATE TRIGGER material_orders_updated_at
  BEFORE UPDATE ON material_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── material_order_items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  category     text NOT NULL CHECK (category IN (
                 'Small Shrubs', 'Medium Shrubs', 'Ground Covers', 'Strappy/Grasses',
                 'Hedging', 'Trees', 'Mulch', 'Edging', 'Turf', 'Drippers', 'Other'
               )),
  description  text NOT NULL DEFAULT '',
  quantity     numeric NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT '',
  unit_price   numeric(10,2),
  notes        text,
  order_index  int NOT NULL DEFAULT 0
);

-- ── material_order_attachments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_order_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  attachment_type text NOT NULL CHECK (attachment_type IN ('invoice', 'photo', 'document')),
  storage_path    text NOT NULL,
  file_name       text NOT NULL,
  uploaded_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── site_stock — one row per site ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_stock (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  plants_140mm     int NOT NULL DEFAULT 0,
  plants_200mm     int NOT NULL DEFAULT 0,
  mulch_tonnes     numeric(8,2) NOT NULL DEFAULT 0,
  edging_metres    numeric(8,2) NOT NULL DEFAULT 0,
  turf_rolls       int NOT NULL DEFAULT 0,
  drippers_packs   int NOT NULL DEFAULT 0,
  last_updated_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS site_stock_updated_at ON site_stock;
CREATE TRIGGER site_stock_updated_at
  BEFORE UPDATE ON site_stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── material_conversion_settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_conversion_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  unit_from        text NOT NULL,
  unit_to          text NOT NULL,
  conversion_rate  numeric(10,4) NOT NULL,
  wastage_pct      numeric(5,2) NOT NULL DEFAULT 0,
  notes            text,
  order_index      int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Default seeded rates — only inserted the first time (table currently empty),
-- so re-running this migration won't duplicate or reset rows an admin edited.
INSERT INTO material_conversion_settings (name, unit_from, unit_to, conversion_rate, wastage_pct, order_index)
SELECT * FROM (VALUES
  ('Mulch',    'tonne', 'm²',            10.0000, 10.00, 1),
  ('Edging',   'pack',  'linear metres', 25.0000,  5.00, 2),
  ('Turf',     'roll',  'm²',            25.0000, 10.00, 3),
  ('Drippers', 'pack',  'units',         50.0000,  5.00, 4)
) AS seed(name, unit_from, unit_to, conversion_rate, wastage_pct, order_index)
WHERE NOT EXISTS (SELECT 1 FROM material_conversion_settings);


-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE material_orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_order_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_stock                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_conversion_settings ENABLE ROW LEVEL SECURITY;

-- material_orders: leading_hand+ insert/update, admin delete, all staff read
DROP POLICY IF EXISTS "material_orders: all staff read" ON material_orders;
CREATE POLICY "material_orders: all staff read"
  ON material_orders FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_orders: leading_hand+ insert" ON material_orders;
CREATE POLICY "material_orders: leading_hand+ insert"
  ON material_orders FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_orders: leading_hand+ update" ON material_orders;
CREATE POLICY "material_orders: leading_hand+ update"
  ON material_orders FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_orders: admin delete" ON material_orders;
CREATE POLICY "material_orders: admin delete"
  ON material_orders FOR DELETE
  USING (current_user_role() = 'admin');

-- material_order_items: same read/write pattern as orders. Delete is
-- leading_hand+ (not admin-only) so editing a draft order's line items works;
-- deleting the parent order (admin-only) still cascades fine since admin
-- also satisfies this policy.
DROP POLICY IF EXISTS "material_order_items: all staff read" ON material_order_items;
CREATE POLICY "material_order_items: all staff read"
  ON material_order_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_items: leading_hand+ insert" ON material_order_items;
CREATE POLICY "material_order_items: leading_hand+ insert"
  ON material_order_items FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_items: leading_hand+ update" ON material_order_items;
CREATE POLICY "material_order_items: leading_hand+ update"
  ON material_order_items FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_items: leading_hand+ delete" ON material_order_items;
CREATE POLICY "material_order_items: leading_hand+ delete"
  ON material_order_items FOR DELETE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- material_order_attachments: same pattern as items (no update — attachments
-- are uploaded/deleted, not edited in place)
DROP POLICY IF EXISTS "material_order_attachments: all staff read" ON material_order_attachments;
CREATE POLICY "material_order_attachments: all staff read"
  ON material_order_attachments FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_attachments: leading_hand+ insert" ON material_order_attachments;
CREATE POLICY "material_order_attachments: leading_hand+ insert"
  ON material_order_attachments FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_attachments: leading_hand+ delete" ON material_order_attachments;
CREATE POLICY "material_order_attachments: leading_hand+ delete"
  ON material_order_attachments FOR DELETE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- site_stock: all staff read, leading_hand+ update. Insert is also
-- leading_hand+ since the app upserts (onConflict: site_id), which Postgres
-- evaluates as an INSERT that may fall back to UPDATE.
DROP POLICY IF EXISTS "site_stock: all staff read" ON site_stock;
CREATE POLICY "site_stock: all staff read"
  ON site_stock FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "site_stock: leading_hand+ insert" ON site_stock;
CREATE POLICY "site_stock: leading_hand+ insert"
  ON site_stock FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "site_stock: leading_hand+ update" ON site_stock;
CREATE POLICY "site_stock: leading_hand+ update"
  ON site_stock FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- material_conversion_settings: admin only write, all staff read
DROP POLICY IF EXISTS "material_conversion_settings: all staff read" ON material_conversion_settings;
CREATE POLICY "material_conversion_settings: all staff read"
  ON material_conversion_settings FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_conversion_settings: admin write" ON material_conversion_settings;
CREATE POLICY "material_conversion_settings: admin write"
  ON material_conversion_settings FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
