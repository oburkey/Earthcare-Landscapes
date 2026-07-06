-- Migration: Fix all FK references to profiles(id) to use ON DELETE SET NULL
--
-- Previously these columns were RESTRICT (default), meaning deleting a user
-- from auth.users would cascade to profiles, which would then fail because
-- 9+ tables hold NOT NULL references to profiles(id) with no delete rule.
--
-- This migration:
--   1. Makes NOT NULL author-style columns nullable (uploaded_by, submitted_by etc.)
--   2. Drops the existing FK constraint and re-adds it with ON DELETE SET NULL
--
-- After this runs, deleting a user cascades: auth.users → profiles (deleted)
-- and all author/submitted-by fields across the DB are automatically set to NULL,
-- preserving the content rows.
--
-- Run this in the Supabase SQL editor.

-- ── extra_job_photos ──────────────────────────────────────────────────────────
ALTER TABLE extra_job_photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE extra_job_photos DROP CONSTRAINT IF EXISTS extra_job_photos_uploaded_by_fkey;
ALTER TABLE extra_job_photos ADD CONSTRAINT extra_job_photos_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── lot_photos ────────────────────────────────────────────────────────────────
ALTER TABLE lot_photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE lot_photos DROP CONSTRAINT IF EXISTS lot_photos_uploaded_by_fkey;
ALTER TABLE lot_photos ADD CONSTRAINT lot_photos_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── lot_documents ─────────────────────────────────────────────────────────────
ALTER TABLE lot_documents ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE lot_documents DROP CONSTRAINT IF EXISTS lot_documents_uploaded_by_fkey;
ALTER TABLE lot_documents ADD CONSTRAINT lot_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── invitations ───────────────────────────────────────────────────────────────
-- invited_by can be null after the inviter is deleted (invitation stays valid)
ALTER TABLE invitations ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey;
ALTER TABLE invitations ADD CONSTRAINT invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── site_plan_documents ───────────────────────────────────────────────────────
ALTER TABLE site_plan_documents ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE site_plan_documents DROP CONSTRAINT IF EXISTS site_plan_documents_uploaded_by_fkey;
ALTER TABLE site_plan_documents ADD CONSTRAINT site_plan_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── toolbox_meetings ──────────────────────────────────────────────────────────
ALTER TABLE toolbox_meetings ALTER COLUMN submitted_by DROP NOT NULL;
ALTER TABLE toolbox_meetings DROP CONSTRAINT IF EXISTS toolbox_meetings_submitted_by_fkey;
ALTER TABLE toolbox_meetings ADD CONSTRAINT toolbox_meetings_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── incidents ─────────────────────────────────────────────────────────────────
ALTER TABLE incidents ALTER COLUMN reported_by DROP NOT NULL;
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_reported_by_fkey;
ALTER TABLE incidents ADD CONSTRAINT incidents_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── incident_photos ───────────────────────────────────────────────────────────
ALTER TABLE incident_photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE incident_photos DROP CONSTRAINT IF EXISTS incident_photos_uploaded_by_fkey;
ALTER TABLE incident_photos ADD CONSTRAINT incident_photos_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── quotes ────────────────────────────────────────────────────────────────────
ALTER TABLE quotes ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_created_by_fkey;
ALTER TABLE quotes ADD CONSTRAINT quotes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── safety_form_completions ───────────────────────────────────────────────────
-- profile_id may already be nullable; add ON DELETE SET NULL so the DB handles
-- it automatically (the app-level null in deleteUserAccount can then be removed)
ALTER TABLE safety_form_completions DROP CONSTRAINT IF EXISTS safety_form_completions_profile_id_fkey;
ALTER TABLE safety_form_completions ADD CONSTRAINT safety_form_completions_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── Nullable columns — only need ON DELETE SET NULL added ────────────────────

ALTER TABLE lot_quotes DROP CONSTRAINT IF EXISTS lot_quotes_quoted_by_fkey;
ALTER TABLE lot_quotes ADD CONSTRAINT lot_quotes_quoted_by_fkey
  FOREIGN KEY (quoted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE plant_ratio_settings DROP CONSTRAINT IF EXISTS plant_ratio_settings_updated_by_fkey;
ALTER TABLE plant_ratio_settings ADD CONSTRAINT plant_ratio_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE lot_trade_status DROP CONSTRAINT IF EXISTS lot_trade_status_updated_by_fkey;
ALTER TABLE lot_trade_status ADD CONSTRAINT lot_trade_status_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
