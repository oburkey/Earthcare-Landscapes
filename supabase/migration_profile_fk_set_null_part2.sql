-- Migration part 2: Fix the 3 safety-module tables missed by migration_profile_fk_set_null.sql
-- These tables were created via Supabase dashboard and not present in version-controlled SQL files.
-- Run this in the Supabase SQL editor after migration_profile_fk_set_null.sql.

-- ── pre_starts ────────────────────────────────────────────────────────────────
ALTER TABLE pre_starts ALTER COLUMN submitted_by DROP NOT NULL;
ALTER TABLE pre_starts DROP CONSTRAINT IF EXISTS pre_starts_submitted_by_fkey;
ALTER TABLE pre_starts ADD CONSTRAINT pre_starts_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── safety_documents ──────────────────────────────────────────────────────────
ALTER TABLE safety_documents ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE safety_documents DROP CONSTRAINT IF EXISTS safety_documents_uploaded_by_fkey;
ALTER TABLE safety_documents ADD CONSTRAINT safety_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── document_signoffs ─────────────────────────────────────────────────────────
ALTER TABLE document_signoffs ALTER COLUMN signed_by DROP NOT NULL;
ALTER TABLE document_signoffs DROP CONSTRAINT IF EXISTS document_signoffs_signed_by_fkey;
ALTER TABLE document_signoffs ADD CONSTRAINT document_signoffs_signed_by_fkey
  FOREIGN KEY (signed_by) REFERENCES profiles(id) ON DELETE SET NULL;
