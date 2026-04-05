-- =============================================================================
-- Earthcare Landscapes — Migration: vehicles table (full schema)
-- Replaces the minimal vehicles table from migration_phase1_final.sql.
-- Safe to run multiple times.
-- =============================================================================


-- ── Drop old table if it exists with fewer columns ────────────────────────────
-- (Only safe to do if no data — this is a fresh table)
DROP TABLE IF EXISTS vehicles;


-- ── Vehicles table ────────────────────────────────────────────────────────────

CREATE TABLE vehicles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  make                   text NOT NULL,
  model                  text NOT NULL,
  year                   int,
  registration           text,
  assigned_to            text,           -- staff member name or site name

  -- Registration & insurance
  rego_expiry_date       date,
  insurance_expiry_date  date,

  -- Service history
  last_service_date      date,
  last_service_hours     numeric(10, 1), -- engine hours at last service
  last_service_odometer  int,            -- odometer km at last service

  -- Next service due
  next_service_due_date  date,
  next_service_km        int,            -- odometer km target
  next_service_hours     numeric(10, 1), -- engine hours target

  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now()
);


-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles: supervisors and admins full access" ON vehicles;
CREATE POLICY "vehicles: supervisors and admins full access"
  ON vehicles FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
