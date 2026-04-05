-- =============================================================================
-- Earthcare Landscapes — Phase 1 Final Migration
-- Adds: vehicles table, due_date on extra_jobs, leading_hand lot_documents write
-- Safe to run multiple times.
-- =============================================================================


-- ── 1. Add due_date to extra_jobs ─────────────────────────────────────────────

ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS due_date date;


-- ── 2. Vehicles table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make         text NOT NULL,
  model        text NOT NULL,
  year         int,
  registration text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles: supervisors and admins full access" ON vehicles;
CREATE POLICY "vehicles: supervisors and admins full access"
  ON vehicles FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- ── 3. Update lot_documents write policy to include leading_hand ──────────────

DROP POLICY IF EXISTS "lot_documents: supervisors and admins write"                  ON lot_documents;
DROP POLICY IF EXISTS "lot_documents: leading_hands supervisors and admins write"    ON lot_documents;

CREATE POLICY "lot_documents: leading_hands supervisors and admins write"
  ON lot_documents FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
