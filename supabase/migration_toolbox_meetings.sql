-- =============================================================================
-- Earthcare Landscapes — Migration: toolbox_meetings table
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS and DROP IF EXISTS throughout.
-- =============================================================================


-- ── 1. New table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS toolbox_meetings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date          date NOT NULL,
  topic         text NOT NULL,
  notes         text,
  attendees     text[] NOT NULL DEFAULT '{}',
  submitted_by  uuid NOT NULL REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS toolbox_meetings_site_id_idx ON toolbox_meetings(site_id);
CREATE INDEX IF NOT EXISTS toolbox_meetings_date_idx    ON toolbox_meetings(date);


-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE toolbox_meetings ENABLE ROW LEVEL SECURITY;


-- ── 3. RLS policies ───────────────────────────────────────────────────────────

-- All staff (worker, leading_hand, supervisor, admin) can read toolbox meetings
DROP POLICY IF EXISTS "toolbox_meetings: staff read all" ON toolbox_meetings;
CREATE POLICY "toolbox_meetings: staff read all"
  ON toolbox_meetings FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Leading hands and above can create/update/delete toolbox meetings
DROP POLICY IF EXISTS "toolbox_meetings: leading_hand+ write" ON toolbox_meetings;
CREATE POLICY "toolbox_meetings: leading_hand+ write"
  ON toolbox_meetings FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
