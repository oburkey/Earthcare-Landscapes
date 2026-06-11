-- =============================================================================
-- Earthcare Landscapes — Migration: lot_trade_status table
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS and DROP IF EXISTS throughout.
-- Storage buckets and their policies are NOT touched here.
-- =============================================================================


-- ── 1. New table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lot_trade_status (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id                uuid NOT NULL UNIQUE REFERENCES lots(id) ON DELETE CASCADE,
  trades_completed      text[] NOT NULL DEFAULT '{}',
  ready_for_landscaping boolean NOT NULL DEFAULT false,
  blocking_notes        text,
  updated_by            uuid REFERENCES profiles(id),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS lot_trade_status_updated_at ON lot_trade_status;
CREATE TRIGGER lot_trade_status_updated_at
  BEFORE UPDATE ON lot_trade_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE lot_trade_status ENABLE ROW LEVEL SECURITY;


-- ── 3. RLS policies ───────────────────────────────────────────────────────────

-- All staff (worker, leading_hand, supervisor, admin) can read trade status
DROP POLICY IF EXISTS "lot_trade_status: staff read all" ON lot_trade_status;
CREATE POLICY "lot_trade_status: staff read all"
  ON lot_trade_status FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Leading hands and above can create/update/delete trade status
DROP POLICY IF EXISTS "lot_trade_status: leading_hand+ write" ON lot_trade_status;
CREATE POLICY "lot_trade_status: leading_hand+ write"
  ON lot_trade_status FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- Clients can read trade status for lots within their permitted sites
DROP POLICY IF EXISTS "lot_trade_status: clients read permitted" ON lot_trade_status;
CREATE POLICY "lot_trade_status: clients read permitted"
  ON lot_trade_status FOR SELECT
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
