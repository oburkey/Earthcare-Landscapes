-- =============================================================================
-- Earthcare Landscapes — Migration: default prices, delay dates, photo
-- notes/categories, plant species dictionary.
-- Safe to run multiple times.
-- =============================================================================

-- ── material_conversion_settings: default unit price ────────────────────────
ALTER TABLE material_conversion_settings ADD COLUMN IF NOT EXISTS default_unit_price numeric(10,2);

-- ── lots / extra_jobs: expected completion date (set alongside a delay) ─────
ALTER TABLE lots       ADD COLUMN IF NOT EXISTS expected_completion_date date;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS expected_completion_date date;

-- ── lot_photos / extra_job_photos: notes + category ─────────────────────────
ALTER TABLE lot_photos       ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE lot_photos       ADD COLUMN IF NOT EXISTS photo_category text;
ALTER TABLE extra_job_photos ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE extra_job_photos ADD COLUMN IF NOT EXISTS photo_category text;

-- Plain text + CHECK (not a new enum, unlike photo_type) so the category list
-- can evolve later without an ALTER TYPE — same approach already used for
-- material_order_attachments.attachment_type.
DO $$ BEGIN
  ALTER TABLE lot_photos ADD CONSTRAINT lot_photos_photo_category_check
    CHECK (photo_category IS NULL OR photo_category IN ('hardscape', 'softscape', 'issue', 'general'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE extra_job_photos ADD CONSTRAINT extra_job_photos_photo_category_check
    CHECK (photo_category IS NULL OR photo_category IN ('hardscape', 'softscape', 'issue', 'general'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── plant_species: growing dictionary of species/pot-size pairs, built up
-- from Materials Orders' bulk-add parser ────────────────────────────────────
CREATE TABLE IF NOT EXISTS plant_species (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text UNIQUE NOT NULL,
  default_pot_size text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plant_species ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_species: all staff read" ON plant_species;
CREATE POLICY "plant_species: all staff read"
  ON plant_species FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Admin-write only per spec. The Materials Orders bulk-add flow (leading_hand+)
-- still populates this dictionary automatically via the admin (service-role)
-- client in createOrder — see orders-actions.ts — the same pattern already
-- used for the pre-start vehicle-hours update and the site_stock delivery
-- write: a narrowly-scoped system write gated by the calling action's own
-- role check rather than this table's RLS.
DROP POLICY IF EXISTS "plant_species: admin write" ON plant_species;
CREATE POLICY "plant_species: admin write"
  ON plant_species FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
