-- =============================================================================
-- Earthcare Landscapes — Migration: incidents & incident_photos tables
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS and DROP IF EXISTS throughout.
-- =============================================================================


-- ── 1. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date             date        NOT NULL,
  time             time,
  type             text        NOT NULL CHECK (type IN ('incident', 'near_miss', 'first_aid', 'property_damage')),
  description      text        NOT NULL,
  people_involved  text,
  immediate_action text,
  reported_by      uuid        NOT NULL REFERENCES profiles(id),
  admin_notes      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  uploaded_by  uuid        NOT NULL REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_site_id_idx   ON incidents(site_id);
CREATE INDEX IF NOT EXISTS incidents_date_idx       ON incidents(date);
CREATE INDEX IF NOT EXISTS incidents_type_idx       ON incidents(type);
CREATE INDEX IF NOT EXISTS incident_photos_incident_id_idx ON incident_photos(incident_id);


-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE incidents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_photos ENABLE ROW LEVEL SECURITY;


-- ── 3. RLS policies — incidents ───────────────────────────────────────────────

-- All staff (worker+) can read incidents
DROP POLICY IF EXISTS "incidents: staff read all" ON incidents;
CREATE POLICY "incidents: staff read all"
  ON incidents FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- leading_hand+ can insert their own incidents
DROP POLICY IF EXISTS "incidents: leading_hand+ insert" ON incidents;
CREATE POLICY "incidents: leading_hand+ insert"
  ON incidents FOR INSERT
  WITH CHECK (
    reported_by = auth.uid()
    AND current_user_role() IN ('leading_hand', 'supervisor', 'admin')
  );

-- Admin only can update (for admin_notes field)
DROP POLICY IF EXISTS "incidents: admin update" ON incidents;
CREATE POLICY "incidents: admin update"
  ON incidents FOR UPDATE
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- Admin only can delete
DROP POLICY IF EXISTS "incidents: admin delete" ON incidents;
CREATE POLICY "incidents: admin delete"
  ON incidents FOR DELETE
  USING (current_user_role() = 'admin');


-- ── 4. RLS policies — incident_photos ────────────────────────────────────────

-- All staff (worker+) can read photos
DROP POLICY IF EXISTS "incident_photos: staff read all" ON incident_photos;
CREATE POLICY "incident_photos: staff read all"
  ON incident_photos FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- leading_hand+ can upload photos
DROP POLICY IF EXISTS "incident_photos: leading_hand+ insert" ON incident_photos;
CREATE POLICY "incident_photos: leading_hand+ insert"
  ON incident_photos FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND current_user_role() IN ('leading_hand', 'supervisor', 'admin')
  );

-- Admin only can delete photos (used by server action before deleting incident)
DROP POLICY IF EXISTS "incident_photos: admin delete" ON incident_photos;
CREATE POLICY "incident_photos: admin delete"
  ON incident_photos FOR DELETE
  USING (current_user_role() = 'admin');


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
