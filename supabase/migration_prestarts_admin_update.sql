-- =============================================================================
-- Earthcare Landscapes — Migration: allow admins to update any pre_start
-- Fixes: admin edits to pre-start date (and other fields) silently failing to
-- persist — updatePreStart's .update() matched zero rows because no RLS
-- policy granted admins UPDATE access on pre_starts.
-- Safe to run multiple times.
-- =============================================================================

-- Optional diagnostic — run this first to see what's currently on the table:
--   SELECT policyname, cmd, permissive, qual, with_check
--   FROM pg_policies
--   WHERE tablename = 'pre_starts';

ALTER TABLE pre_starts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pre_starts: admin update all" ON pre_starts;
CREATE POLICY "pre_starts: admin update all"
  ON pre_starts FOR UPDATE
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
