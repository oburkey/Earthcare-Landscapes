-- =============================================================================
-- Earthcare Landscapes — Migration: email_recipients table
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS and DROP IF EXISTS throughout.
-- =============================================================================


-- ── 1. New table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_recipients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);


-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;


-- ── 3. RLS policies — admin only ─────────────────────────────────────────────

DROP POLICY IF EXISTS "email_recipients: admin full access" ON email_recipients;
CREATE POLICY "email_recipients: admin full access"
  ON email_recipients FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
