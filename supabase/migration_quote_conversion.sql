-- =============================================================================
-- Earthcare Landscapes — Migration: Quote to Extra Job Conversion
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS and DROP IF EXISTS throughout.
-- =============================================================================


-- ── 1. Ensure quotes table exists ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quotes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES sites(id),
  stage_id    uuid REFERENCES stages(id),
  reference   text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'draft',
  line_items  jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes       text NOT NULL DEFAULT '',
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS quotes_updated_at ON quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes: supervisor+ full access" ON quotes;
CREATE POLICY "quotes: supervisor+ full access"
  ON quotes FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- ── 2. Add stage_id to quotes (if table already existed without it) ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'stage_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN stage_id uuid REFERENCES stages(id);
  END IF;
END $$;


-- ── 3. Add source_quote_id to extra_jobs ─────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extra_jobs' AND column_name = 'source_quote_id'
  ) THEN
    ALTER TABLE extra_jobs ADD COLUMN source_quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS extra_jobs_source_quote_id_idx ON extra_jobs(source_quote_id);


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
