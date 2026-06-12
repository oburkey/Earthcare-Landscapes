-- =============================================================================
-- Earthcare Landscapes — Migration: lots.build_completed_at
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS throughout.
-- =============================================================================

ALTER TABLE lots ADD COLUMN IF NOT EXISTS build_completed_at timestamptz;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
