-- =============================================================================
-- Earthcare Landscapes — Migration: email_recipients.email_type
-- Splits the single recipients list into weekly / monthly / both, so the two
-- scheduled reports can go to different people.
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS throughout.
-- =============================================================================

ALTER TABLE email_recipients ADD COLUMN IF NOT EXISTS email_type text NOT NULL DEFAULT 'both'
  CHECK (email_type IN ('weekly', 'monthly', 'both'));

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
