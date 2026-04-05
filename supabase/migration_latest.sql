-- =============================================================================
-- Earthcare Landscapes — Migration: staff_members and contacts tables
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS and DROP IF EXISTS throughout.
-- Storage buckets and their policies are NOT touched here.
-- =============================================================================


-- ── 1. New tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  phone_number text,
  role         role NOT NULL DEFAULT 'worker',
  credentials  text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  company    text,
  phone      text,
  email      text,
  category   text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts      ENABLE ROW LEVEL SECURITY;


-- ── 3. RLS policies ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "staff_members: supervisors and admins full access" ON staff_members;
CREATE POLICY "staff_members: supervisors and admins full access"
  ON staff_members FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

DROP POLICY IF EXISTS "contacts: leading_hands and above read" ON contacts;
CREATE POLICY "contacts: leading_hands and above read"
  ON contacts FOR SELECT
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "contacts: supervisors and admins write" ON contacts;
CREATE POLICY "contacts: supervisors and admins write"
  ON contacts FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
