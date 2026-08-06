-- =============================================================================
-- Earthcare Landscapes — Migration: extra_jobs.finance_notes
-- Free-text note finance can attach to an extra job for invoicing purposes
-- (e.g. "Invoice to XYZ Pty Ltd"). Shown on the extra job's claim sheet PDF.
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS throughout.
-- =============================================================================

ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS finance_notes text;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
