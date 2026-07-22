-- =============================================================================
-- Earthcare Landscapes — Migration: re-apply Materials RLS policies
-- Orders/Stock/Settings tabs return "Something went wrong" on save. Tables
-- exist; this re-issues every INSERT/UPDATE/DELETE policy from
-- migration_materials_orders.sql. Every statement here is DROP POLICY IF
-- EXISTS + CREATE POLICY, so it's safe to run even if some policies already
-- exist correctly — this just guarantees convergence without needing to know
-- which ones are missing.
-- Run the diagnostic below FIRST if you want to see current state before/after:
--   SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename IN ('material_orders', 'material_order_items', 'material_order_attachments', 'site_stock', 'material_conversion_settings')
--   ORDER BY tablename, cmd;
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
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_orders: admin delete" ON material_orders;
CREATE POLICY "material_orders: admin delete"
  ON material_orders FOR DELETE
  USING (current_user_role() = 'admin');

-- material_order_items
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
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_items: leading_hand+ delete" ON material_order_items;
CREATE POLICY "material_order_items: leading_hand+ delete"
  ON material_order_items FOR DELETE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- material_order_attachments
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

-- site_stock: all staff read, leading_hand+ insert/update (insert needed —
-- the app upserts with onConflict: site_id, which Postgres evaluates as an
-- INSERT that may fall back to UPDATE, so both policies must pass)
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
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

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
