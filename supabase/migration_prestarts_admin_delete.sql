-- =============================================================================
-- Earthcare Landscapes — Migration: allow admins to delete any pre_start
-- Fixes: admin deletes of a pre-start appearing to succeed (confirmation shown,
-- row removed from local state) but reappearing after navigating away and back.
-- deletePreStart's .delete() matched zero rows because no RLS policy granted
-- admins DELETE access on pre_starts — same root cause as the earlier
-- migration_prestarts_admin_update.sql fix, just for DELETE instead of UPDATE.
-- Safe to run multiple times.
-- =============================================================================

-- Optional diagnostic — run this first to see what's currently on the table:
--   SELECT policyname, cmd, permissive, qual, with_check
--   FROM pg_policies
--   WHERE tablename = 'pre_starts';

ALTER TABLE pre_starts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pre_starts: admin delete all" ON pre_starts;
CREATE POLICY "pre_starts: admin delete all"
  ON pre_starts FOR DELETE
  USING (current_user_role() = 'admin');

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
