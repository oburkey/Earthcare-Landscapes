-- =============================================================================
-- Migration: Photo storage support
-- Run this in the Supabase SQL Editor AFTER the initial schema.sql
-- =============================================================================


-- ── Add site plan photo columns ───────────────────────────────────────────────

ALTER TABLE sites  ADD COLUMN IF NOT EXISTS site_plan_path text;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS site_plan_path text;


-- ── Create storage buckets ────────────────────────────────────────────────────
-- Both buckets are private; access is via signed URLs generated server-side.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('lot-photos',  'lot-photos',  false),
  ('site-plans',  'site-plans',  false)
ON CONFLICT (id) DO NOTHING;


-- ── Storage RLS: lot-photos ───────────────────────────────────────────────────

-- Any authenticated user can read (role filtering happens at the DB layer)
CREATE POLICY "lot-photos: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lot-photos');

-- Any authenticated user can upload
CREATE POLICY "lot-photos: authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lot-photos');

-- Only supervisors and admins can delete
CREATE POLICY "lot-photos: supervisors and admins delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lot-photos'
    AND current_user_role() IN ('supervisor', 'admin')
  );


-- ── Storage RLS: site-plans ───────────────────────────────────────────────────

-- Any authenticated user can read site plans
CREATE POLICY "site-plans: authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'site-plans');

-- Only admins can upload / overwrite / delete site plans
CREATE POLICY "site-plans: admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-plans' AND current_user_role() = 'admin');

CREATE POLICY "site-plans: admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-plans' AND current_user_role() = 'admin');

CREATE POLICY "site-plans: admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-plans' AND current_user_role() = 'admin');


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
