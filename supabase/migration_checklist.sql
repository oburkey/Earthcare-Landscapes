-- =============================================================================
-- Earthcare Landscapes — Migration: lot_checklist_items table + lots.extras_notes
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS and DROP IF EXISTS throughout.
-- Storage buckets and their policies are NOT touched here.
-- =============================================================================


-- ── 1. New columns ────────────────────────────────────────────────────────────

ALTER TABLE lots ADD COLUMN IF NOT EXISTS extras_notes text;


-- ── 2. New table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lot_checklist_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id         uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  section        text NOT NULL CHECK (section IN ('pre_checks', 'landscaping_works', 'finishing')),
  item_key       text NOT NULL,
  completed      boolean NOT NULL DEFAULT false,
  response       text CHECK (response IN ('yes', 'no')),
  completed_date date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lot_id, item_key)
);

DROP TRIGGER IF EXISTS lot_checklist_items_updated_at ON lot_checklist_items;
CREATE TRIGGER lot_checklist_items_updated_at
  BEFORE UPDATE ON lot_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 3. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE lot_checklist_items ENABLE ROW LEVEL SECURITY;


-- ── 4. RLS policies ───────────────────────────────────────────────────────────

-- All staff (worker, leading_hand, supervisor, admin) can read the checklist
DROP POLICY IF EXISTS "lot_checklist_items: staff read all" ON lot_checklist_items;
CREATE POLICY "lot_checklist_items: staff read all"
  ON lot_checklist_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Leading hands and above can create/update/delete checklist items
DROP POLICY IF EXISTS "lot_checklist_items: leading_hand+ write" ON lot_checklist_items;
CREATE POLICY "lot_checklist_items: leading_hand+ write"
  ON lot_checklist_items FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- Clients can read the checklist for lots within their permitted sites
DROP POLICY IF EXISTS "lot_checklist_items: clients read permitted" ON lot_checklist_items;
CREATE POLICY "lot_checklist_items: clients read permitted"
  ON lot_checklist_items FOR SELECT
  USING (
    current_user_role() = 'client'
    AND lot_id IN (
      SELECT l.id FROM lots l
      JOIN stages s ON s.id = l.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
