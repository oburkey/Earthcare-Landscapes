-- =============================================================================
-- Earthcare Landscapes — Migration: trailer support
-- Adds trailers as a vehicle_type ('Trailer') with their own simplified field
-- set, and links pre_starts to a specific trailer the same way machine_id /
-- truck_id already link to machinery/trucks.
-- Safe to run multiple times.
-- =============================================================================

-- ── vehicles: trailers use `name` instead of make/model, and don't have a
--    make/model at all — so make/model can no longer be NOT NULL. ────────────

ALTER TABLE vehicles ALTER COLUMN make  DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN model DROP NOT NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS name text;

-- vehicle_type is a free-text column (no CHECK constraint / enum), so no
-- schema change is needed to start using the value 'Trailer' — the app now
-- just writes it like it already does 'Truck' / 'Machinery' / 'Ute'.


-- ── pre_starts: link a trailer pre-start to a specific trailer vehicle,
--    mirroring the existing machine_id / truck_id columns. ────────────────────
--
-- NOTE: pre_starts isn't tracked in this repo's schema.sql (it was created
-- directly in the Supabase dashboard), so the exact existing definition of
-- machine_id / truck_id can't be confirmed from source. This mirrors the
-- shape the application code assumes for them (nullable uuid referencing
-- vehicles.id). Please sanity-check against the live pre_starts schema
-- before running if that assumption looks wrong.

ALTER TABLE pre_starts
  ADD COLUMN IF NOT EXISTS trailer_id uuid REFERENCES vehicles(id) ON DELETE SET NULL;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
