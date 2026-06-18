-- =============================================================================
-- Earthcare Landscapes — Migration: Fix source_quote_id FK constraint
-- Changes ON DELETE behavior from RESTRICT to SET NULL so deleting a quote
-- doesn't block deletion — the extra job's source_quote_id becomes null.
-- Safe to run multiple times.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'extra_jobs_source_quote_id_fkey'
      AND table_name = 'extra_jobs'
  ) THEN
    ALTER TABLE extra_jobs DROP CONSTRAINT extra_jobs_source_quote_id_fkey;
    ALTER TABLE extra_jobs
      ADD CONSTRAINT extra_jobs_source_quote_id_fkey
      FOREIGN KEY (source_quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
