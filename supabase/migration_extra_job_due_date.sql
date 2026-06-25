-- =============================================================================
-- Earthcare Landscapes — Migration: Extra Job Due Dates
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times.
-- =============================================================================

ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS due_date date;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
