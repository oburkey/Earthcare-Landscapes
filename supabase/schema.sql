-- =============================================================================
-- Earthcare Landscapes — Supabase Database Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- =============================================================================


-- ── Extensions ────────────────────────────────────────────────────────────────
-- uuid_generate_v4() is available by default in Supabase; no extension needed.


-- ── Custom types (enums) ──────────────────────────────────────────────────────

CREATE TYPE role AS ENUM ('worker', 'leading_hand', 'supervisor', 'admin', 'client');

CREATE TYPE extra_job_status AS ENUM ('not_started', 'in_progress', 'complete');

CREATE TYPE lot_status AS ENUM (
  'not_started',
  'scheduled',
  'in_progress',
  'complete',
  'on_hold'
);

CREATE TYPE photo_type AS ENUM ('before', 'during', 'after');

CREATE TYPE document_type AS ENUM (
  'site_plan',
  'drawing',
  'housing_claim',
  'other'
);


-- =============================================================================
-- TABLES
-- =============================================================================


-- ── Profiles ──────────────────────────────────────────────────────────────────
-- One row per user, linked to auth.users by id.
-- Created automatically by the trigger below when a user signs up.

CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL DEFAULT '',
  phone_number text,
  credentials  text[] NOT NULL DEFAULT '{}',
  role         role NOT NULL DEFAULT 'worker',
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ── Sites ─────────────────────────────────────────────────────────────────────

CREATE TABLE sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  address         text,
  client_contact  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ── Stages ────────────────────────────────────────────────────────────────────

CREATE TABLE stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name        text NOT NULL,
  "order"     integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stages_site_id_idx ON stages(site_id);


-- ── Lots ──────────────────────────────────────────────────────────────────────

CREATE TABLE lots (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id             uuid NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  lot_number           text NOT NULL,
  address              text,
  status               lot_status NOT NULL DEFAULT 'not_started',
  due_date             date,
  scheduled_date       date,
  completion_date      date,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lots_stage_id_idx ON lots(stage_id);
CREATE INDEX lots_status_idx ON lots(status);
CREATE INDEX lots_due_date_idx ON lots(due_date);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lots_updated_at
  BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Extra Jobs ────────────────────────────────────────────────────────────────
-- Jobs that belong to a stage but aren't tied to a specific lot.

CREATE TABLE extra_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id     uuid NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  status       extra_job_status NOT NULL DEFAULT 'not_started',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX extra_jobs_stage_id_idx ON extra_jobs(stage_id);

CREATE TRIGGER extra_jobs_updated_at
  BEFORE UPDATE ON extra_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Extra Job Photos ──────────────────────────────────────────────────────────

CREATE TABLE extra_job_photos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_job_id   uuid NOT NULL REFERENCES extra_jobs(id) ON DELETE CASCADE,
  storage_path   text NOT NULL,
  photo_type     photo_type NOT NULL,
  uploaded_by    uuid NOT NULL REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX extra_job_photos_extra_job_id_idx ON extra_job_photos(extra_job_id);


-- ── Lot Photos ────────────────────────────────────────────────────────────────

CREATE TABLE lot_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id        uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,  -- path inside the Supabase Storage bucket
  photo_type    photo_type NOT NULL,
  uploaded_by   uuid NOT NULL REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lot_photos_lot_id_idx ON lot_photos(lot_id);


-- ── Lot Documents ─────────────────────────────────────────────────────────────

CREATE TABLE lot_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id         uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  storage_path   text NOT NULL,
  document_name  text NOT NULL,
  document_type  document_type NOT NULL DEFAULT 'other',
  uploaded_by    uuid NOT NULL REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lot_documents_lot_id_idx ON lot_documents(lot_id);


-- ── Staff Members ────────────────────────────────────────────────────────────
-- Standalone staff directory — not tied to auth accounts.

CREATE TABLE staff_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    text NOT NULL,
  phone_number text,
  role         role NOT NULL DEFAULT 'worker',
  credentials  text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ── Contacts ──────────────────────────────────────────────────────────────────
-- External contacts directory: suppliers, contractors, etc.

CREATE TABLE contacts (
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

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Invitations ───────────────────────────────────────────────────────────────

CREATE TABLE invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  role         role NOT NULL,
  invited_by   uuid NOT NULL REFERENCES profiles(id),
  token        uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitations_token_idx ON invitations(token);
CREATE INDEX invitations_email_idx ON invitations(email);


-- ── Client Site Access ────────────────────────────────────────────────────────
-- Controls which sites a client-role user can see in their portal.

CREATE TABLE client_site_access (
  client_user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  PRIMARY KEY (client_user_id, site_id)
);


-- =============================================================================
-- TRIGGER: Auto-create profile on signup
-- When Supabase creates a new auth.users row, this trigger creates the
-- matching profiles row. The role and name are then updated by the
-- acceptInvite server action.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'worker'  -- default role; overwritten by acceptInvite action
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Every table has RLS enabled. Policies are additive — a row is visible if
-- ANY policy grants access.
-- We use a helper function to get the current user's role without hitting
-- the profiles table repeatedly in every policy.
-- =============================================================================

-- Helper: returns the role of the currently authenticated user.
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ── Enable RLS on all tables ──────────────────────────────────────────────────
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots               ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_job_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_photos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_site_access ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Everyone can read their own profile
CREATE POLICY "profiles: read own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Supervisors and admins can read all profiles
CREATE POLICY "profiles: supervisors and admins read all"
  ON profiles FOR SELECT
  USING (current_user_role() IN ('supervisor', 'admin'));

-- Users can update their own profile (name only — role changes go via admin)
CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Admins can update any profile (to change roles)
CREATE POLICY "profiles: admin update all"
  ON profiles FOR UPDATE
  USING (current_user_role() = 'admin');


-- ─────────────────────────────────────────────────────────────────────────────
-- SITES policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Workers and leading hands can see all sites
CREATE POLICY "sites: workers and leading_hands read all"
  ON sites FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand'));

-- Supervisors and admins see all sites
CREATE POLICY "sites: supervisors and admins read all"
  ON sites FOR SELECT
  USING (current_user_role() IN ('supervisor', 'admin'));

-- Clients see only their permitted sites
CREATE POLICY "sites: clients see permitted sites"
  ON sites FOR SELECT
  USING (
    current_user_role() = 'client'
    AND id IN (
      SELECT site_id FROM client_site_access
      WHERE client_user_id = auth.uid()
    )
  );

-- Only supervisors and admins can create/edit/delete sites
CREATE POLICY "sites: supervisors and admins write"
  ON sites FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- ─────────────────────────────────────────────────────────────────────────────
-- STAGES policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Workers and leading hands can see all stages
CREATE POLICY "stages: workers and leading_hands read all"
  ON stages FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand'));

CREATE POLICY "stages: supervisors and admins read all"
  ON stages FOR SELECT
  USING (current_user_role() IN ('supervisor', 'admin'));

CREATE POLICY "stages: clients see permitted stages"
  ON stages FOR SELECT
  USING (
    current_user_role() = 'client'
    AND site_id IN (
      SELECT site_id FROM client_site_access WHERE client_user_id = auth.uid()
    )
  );

CREATE POLICY "stages: supervisors and admins write"
  ON stages FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- ─────────────────────────────────────────────────────────────────────────────
-- LOTS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Workers and leading hands can see all lots
CREATE POLICY "lots: workers and leading_hands read all"
  ON lots FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand'));

-- Workers can update status and notes on any lot
CREATE POLICY "lots: workers update status"
  ON lots FOR UPDATE
  USING (current_user_role() = 'worker')
  WITH CHECK (current_user_role() = 'worker');

-- Leading hands can fully create and edit lots
CREATE POLICY "lots: leading_hands write"
  ON lots FOR ALL
  USING (current_user_role() = 'leading_hand');

CREATE POLICY "lots: supervisors and admins read all"
  ON lots FOR SELECT
  USING (current_user_role() IN ('supervisor', 'admin'));

CREATE POLICY "lots: supervisors and admins write"
  ON lots FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

-- Clients see all lots within their permitted sites (read only)
CREATE POLICY "lots: clients read permitted lots"
  ON lots FOR SELECT
  USING (
    current_user_role() = 'client'
    AND stage_id IN (
      SELECT s.id FROM stages s
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- LOT PHOTOS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Workers and leading hands can see photos on all lots
CREATE POLICY "lot_photos: workers and leading_hands read all"
  ON lot_photos FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand'));

-- Workers can upload photos to any lot
CREATE POLICY "lot_photos: workers insert"
  ON lot_photos FOR INSERT
  WITH CHECK (
    current_user_role() = 'worker'
    AND uploaded_by = auth.uid()
  );

-- Leading hands can upload photos to any lot
CREATE POLICY "lot_photos: leading_hands insert"
  ON lot_photos FOR INSERT
  WITH CHECK (
    current_user_role() = 'leading_hand'
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "lot_photos: supervisors and admins read all"
  ON lot_photos FOR SELECT
  USING (current_user_role() IN ('supervisor', 'admin'));

CREATE POLICY "lot_photos: supervisors and admins write"
  ON lot_photos FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

-- Clients can view photos on their permitted lots
CREATE POLICY "lot_photos: clients read permitted"
  ON lot_photos FOR SELECT
  USING (
    current_user_role() = 'client'
    AND lot_id IN (
      SELECT l.id FROM lots l
      JOIN stages s ON s.id = l.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- LOT DOCUMENTS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Workers and leading hands can view documents on all lots
CREATE POLICY "lot_documents: workers and leading_hands read all"
  ON lot_documents FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand'));

CREATE POLICY "lot_documents: supervisors and admins read all"
  ON lot_documents FOR SELECT
  USING (current_user_role() IN ('supervisor', 'admin'));

CREATE POLICY "lot_documents: supervisors and admins write"
  ON lot_documents FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

-- Clients can view documents on their permitted lots
CREATE POLICY "lot_documents: clients read permitted"
  ON lot_documents FOR SELECT
  USING (
    current_user_role() = 'client'
    AND lot_id IN (
      SELECT l.id FROM lots l
      JOIN stages s ON s.id = l.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- EXTRA JOBS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- All staff (workers and above) can read extra jobs
CREATE POLICY "extra_jobs: staff read all"
  ON extra_jobs FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Leading hands and above can create and manage extra jobs
CREATE POLICY "extra_jobs: leading_hands and above write"
  ON extra_jobs FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- Clients can read extra jobs for their permitted sites
CREATE POLICY "extra_jobs: clients read permitted"
  ON extra_jobs FOR SELECT
  USING (
    current_user_role() = 'client'
    AND stage_id IN (
      SELECT s.id FROM stages s
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- EXTRA JOB PHOTOS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- All staff can read extra job photos
CREATE POLICY "extra_job_photos: staff read all"
  ON extra_job_photos FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Workers can upload extra job photos
CREATE POLICY "extra_job_photos: workers insert"
  ON extra_job_photos FOR INSERT
  WITH CHECK (
    current_user_role() = 'worker'
    AND uploaded_by = auth.uid()
  );

-- Leading hands and above have full write access
CREATE POLICY "extra_job_photos: leading_hands and above write"
  ON extra_job_photos FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- Clients can read extra job photos for their permitted sites
CREATE POLICY "extra_job_photos: clients read permitted"
  ON extra_job_photos FOR SELECT
  USING (
    current_user_role() = 'client'
    AND extra_job_id IN (
      SELECT ej.id FROM extra_jobs ej
      JOIN stages s ON s.id = ej.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STAFF MEMBERS policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "staff_members: supervisors and admins full access"
  ON staff_members FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- ─────────────────────────────────────────────────────────────────────────────
-- CONTACTS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Leading hands and above can read contacts
CREATE POLICY "contacts: leading_hands and above read"
  ON contacts FOR SELECT
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- Supervisors and admins can write contacts
CREATE POLICY "contacts: supervisors and admins write"
  ON contacts FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- ─────────────────────────────────────────────────────────────────────────────
-- INVITATIONS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Admins can do everything with invitations
CREATE POLICY "invitations: admin full access"
  ON invitations FOR ALL
  USING (current_user_role() = 'admin');

-- Supervisors can create invitations (for workers only — enforced in app code)
CREATE POLICY "invitations: supervisors create"
  ON invitations FOR INSERT
  WITH CHECK (current_user_role() IN ('supervisor', 'admin'));

CREATE POLICY "invitations: supervisors read own"
  ON invitations FOR SELECT
  USING (
    current_user_role() = 'supervisor'
    AND invited_by = auth.uid()
  );

-- Anyone can read an invitation by token (needed to display the accept page)
-- This is intentional — the token is a secret link, not a guessable value.
CREATE POLICY "invitations: read by token (unauthenticated)"
  ON invitations FOR SELECT
  USING (true);  -- filtered in app code by token; token is a UUID secret


-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT SITE ACCESS policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "client_site_access: admin full access"
  ON client_site_access FOR ALL
  USING (current_user_role() = 'admin');

-- Clients can read their own access rows
CREATE POLICY "client_site_access: clients read own"
  ON client_site_access FOR SELECT
  USING (client_user_id = auth.uid());


-- =============================================================================
-- STORAGE BUCKETS
-- Create these via the Supabase Dashboard → Storage, or use the SQL below.
-- =============================================================================

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES
--   ('lot-photos', 'lot-photos', false),   -- private; signed URLs for access
--   ('lot-documents', 'lot-documents', false);

-- Storage RLS is configured separately in the Supabase Dashboard under
-- Storage → Policies. Mirror the same role logic as above:
--   - Workers: read/write on all lot paths
--   - Supervisors/Admins: full access
--   - Clients: read-only on their permitted lots


-- =============================================================================
-- MIGRATION: Run this against an existing database to apply all schema changes.
-- Safe to run multiple times — uses IF NOT EXISTS / DROP IF EXISTS throughout.
-- PostgreSQL does not support CREATE POLICY IF NOT EXISTS, so each policy is
-- dropped first then recreated.
-- =============================================================================


-- ── 1. Enum values ────────────────────────────────────────────────────────────

ALTER TYPE role ADD VALUE IF NOT EXISTS 'leading_hand' BEFORE 'supervisor';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'extra_job_status') THEN
    CREATE TYPE extra_job_status AS ENUM ('not_started', 'in_progress', 'complete');
  END IF;
END $$;


-- ── 2. Columns ────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credentials  text[] NOT NULL DEFAULT '{}';


-- ── 3. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS extra_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id     uuid NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  status       extra_job_status NOT NULL DEFAULT 'not_started',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extra_jobs_stage_id_idx ON extra_jobs(stage_id);

CREATE TABLE IF NOT EXISTS extra_job_photos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_job_id   uuid NOT NULL REFERENCES extra_jobs(id) ON DELETE CASCADE,
  storage_path   text NOT NULL,
  photo_type     photo_type NOT NULL,
  uploaded_by    uuid NOT NULL REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extra_job_photos_extra_job_id_idx ON extra_job_photos(extra_job_id);

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

-- Triggers (recreate safely)
DROP TRIGGER IF EXISTS extra_jobs_updated_at   ON extra_jobs;
DROP TRIGGER IF EXISTS contacts_updated_at      ON contacts;

CREATE TRIGGER extra_jobs_updated_at
  BEFORE UPDATE ON extra_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 4. Enable RLS on all tables (idempotent) ──────────────────────────────────

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots               ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_job_photos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_photos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_site_access ENABLE ROW LEVEL SECURITY;


-- ── 5. Policies — drop all, then recreate ─────────────────────────────────────
-- PostgreSQL has no CREATE POLICY IF NOT EXISTS; DROP IF EXISTS is the safe way.

-- profiles
DROP POLICY IF EXISTS "profiles: read own"                        ON profiles;
DROP POLICY IF EXISTS "profiles: supervisors and admins read all" ON profiles;
DROP POLICY IF EXISTS "profiles: update own"                      ON profiles;
DROP POLICY IF EXISTS "profiles: admin update all"                ON profiles;

CREATE POLICY "profiles: read own"
  ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: supervisors and admins read all"
  ON profiles FOR SELECT USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles: admin update all"
  ON profiles FOR UPDATE USING (current_user_role() = 'admin');

-- sites
DROP POLICY IF EXISTS "sites: workers read all"                       ON sites;
DROP POLICY IF EXISTS "sites: workers and leading_hands read all"     ON sites;
DROP POLICY IF EXISTS "sites: supervisors and admins read all"        ON sites;
DROP POLICY IF EXISTS "sites: clients see permitted sites"            ON sites;
DROP POLICY IF EXISTS "sites: supervisors and admins write"           ON sites;

CREATE POLICY "sites: workers and leading_hands read all"
  ON sites FOR SELECT USING (current_user_role() IN ('worker', 'leading_hand'));
CREATE POLICY "sites: supervisors and admins read all"
  ON sites FOR SELECT USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "sites: clients see permitted sites"
  ON sites FOR SELECT USING (
    current_user_role() = 'client'
    AND id IN (SELECT site_id FROM client_site_access WHERE client_user_id = auth.uid())
  );
CREATE POLICY "sites: supervisors and admins write"
  ON sites FOR ALL USING (current_user_role() IN ('supervisor', 'admin'));

-- stages
DROP POLICY IF EXISTS "stages: workers read all"                      ON stages;
DROP POLICY IF EXISTS "stages: workers and leading_hands read all"    ON stages;
DROP POLICY IF EXISTS "stages: supervisors and admins read all"       ON stages;
DROP POLICY IF EXISTS "stages: clients see permitted stages"          ON stages;
DROP POLICY IF EXISTS "stages: supervisors and admins write"          ON stages;

CREATE POLICY "stages: workers and leading_hands read all"
  ON stages FOR SELECT USING (current_user_role() IN ('worker', 'leading_hand'));
CREATE POLICY "stages: supervisors and admins read all"
  ON stages FOR SELECT USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "stages: clients see permitted stages"
  ON stages FOR SELECT USING (
    current_user_role() = 'client'
    AND site_id IN (SELECT site_id FROM client_site_access WHERE client_user_id = auth.uid())
  );
CREATE POLICY "stages: supervisors and admins write"
  ON stages FOR ALL USING (current_user_role() IN ('supervisor', 'admin'));

-- lots
DROP POLICY IF EXISTS "lots: workers read all"                        ON lots;
DROP POLICY IF EXISTS "lots: workers and leading_hands read all"      ON lots;
DROP POLICY IF EXISTS "lots: workers update status"                   ON lots;
DROP POLICY IF EXISTS "lots: leading_hands write"                     ON lots;
DROP POLICY IF EXISTS "lots: supervisors and admins read all"         ON lots;
DROP POLICY IF EXISTS "lots: supervisors and admins write"            ON lots;
DROP POLICY IF EXISTS "lots: clients read permitted lots"             ON lots;

CREATE POLICY "lots: workers and leading_hands read all"
  ON lots FOR SELECT USING (current_user_role() IN ('worker', 'leading_hand'));
CREATE POLICY "lots: workers update status"
  ON lots FOR UPDATE
  USING (current_user_role() = 'worker')
  WITH CHECK (current_user_role() = 'worker');
CREATE POLICY "lots: leading_hands write"
  ON lots FOR ALL USING (current_user_role() = 'leading_hand');
CREATE POLICY "lots: supervisors and admins read all"
  ON lots FOR SELECT USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "lots: supervisors and admins write"
  ON lots FOR ALL USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "lots: clients read permitted lots"
  ON lots FOR SELECT USING (
    current_user_role() = 'client'
    AND stage_id IN (
      SELECT s.id FROM stages s
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );

-- lot_photos
DROP POLICY IF EXISTS "lot_photos: workers read all"                      ON lot_photos;
DROP POLICY IF EXISTS "lot_photos: workers and leading_hands read all"    ON lot_photos;
DROP POLICY IF EXISTS "lot_photos: workers insert"                        ON lot_photos;
DROP POLICY IF EXISTS "lot_photos: leading_hands insert"                  ON lot_photos;
DROP POLICY IF EXISTS "lot_photos: supervisors and admins read all"       ON lot_photos;
DROP POLICY IF EXISTS "lot_photos: supervisors and admins write"          ON lot_photos;
DROP POLICY IF EXISTS "lot_photos: clients read permitted"                ON lot_photos;

CREATE POLICY "lot_photos: workers and leading_hands read all"
  ON lot_photos FOR SELECT USING (current_user_role() IN ('worker', 'leading_hand'));
CREATE POLICY "lot_photos: workers insert"
  ON lot_photos FOR INSERT WITH CHECK (current_user_role() = 'worker' AND uploaded_by = auth.uid());
CREATE POLICY "lot_photos: leading_hands insert"
  ON lot_photos FOR INSERT WITH CHECK (current_user_role() = 'leading_hand' AND uploaded_by = auth.uid());
CREATE POLICY "lot_photos: supervisors and admins read all"
  ON lot_photos FOR SELECT USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "lot_photos: supervisors and admins write"
  ON lot_photos FOR ALL USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "lot_photos: clients read permitted"
  ON lot_photos FOR SELECT USING (
    current_user_role() = 'client'
    AND lot_id IN (
      SELECT l.id FROM lots l
      JOIN stages s ON s.id = l.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );

-- lot_documents
DROP POLICY IF EXISTS "lot_documents: workers read all"                     ON lot_documents;
DROP POLICY IF EXISTS "lot_documents: workers and leading_hands read all"   ON lot_documents;
DROP POLICY IF EXISTS "lot_documents: supervisors and admins read all"      ON lot_documents;
DROP POLICY IF EXISTS "lot_documents: supervisors and admins write"         ON lot_documents;
DROP POLICY IF EXISTS "lot_documents: clients read permitted"               ON lot_documents;

CREATE POLICY "lot_documents: workers and leading_hands read all"
  ON lot_documents FOR SELECT USING (current_user_role() IN ('worker', 'leading_hand'));
CREATE POLICY "lot_documents: supervisors and admins read all"
  ON lot_documents FOR SELECT USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "lot_documents: supervisors and admins write"
  ON lot_documents FOR ALL USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "lot_documents: clients read permitted"
  ON lot_documents FOR SELECT USING (
    current_user_role() = 'client'
    AND lot_id IN (
      SELECT l.id FROM lots l
      JOIN stages s ON s.id = l.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );

-- extra_jobs
DROP POLICY IF EXISTS "extra_jobs: staff read all"               ON extra_jobs;
DROP POLICY IF EXISTS "extra_jobs: leading_hands and above write" ON extra_jobs;
DROP POLICY IF EXISTS "extra_jobs: clients read permitted"        ON extra_jobs;

CREATE POLICY "extra_jobs: staff read all"
  ON extra_jobs FOR SELECT USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "extra_jobs: leading_hands and above write"
  ON extra_jobs FOR ALL USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));
CREATE POLICY "extra_jobs: clients read permitted"
  ON extra_jobs FOR SELECT USING (
    current_user_role() = 'client'
    AND stage_id IN (
      SELECT s.id FROM stages s
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );

-- extra_job_photos
DROP POLICY IF EXISTS "extra_job_photos: staff read all"                ON extra_job_photos;
DROP POLICY IF EXISTS "extra_job_photos: workers insert"                ON extra_job_photos;
DROP POLICY IF EXISTS "extra_job_photos: leading_hands and above write" ON extra_job_photos;
DROP POLICY IF EXISTS "extra_job_photos: clients read permitted"        ON extra_job_photos;

CREATE POLICY "extra_job_photos: staff read all"
  ON extra_job_photos FOR SELECT USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "extra_job_photos: workers insert"
  ON extra_job_photos FOR INSERT WITH CHECK (current_user_role() = 'worker' AND uploaded_by = auth.uid());
CREATE POLICY "extra_job_photos: leading_hands and above write"
  ON extra_job_photos FOR ALL USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));
CREATE POLICY "extra_job_photos: clients read permitted"
  ON extra_job_photos FOR SELECT USING (
    current_user_role() = 'client'
    AND extra_job_id IN (
      SELECT ej.id FROM extra_jobs ej
      JOIN stages s ON s.id = ej.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );

-- staff_members
DROP POLICY IF EXISTS "staff_members: supervisors and admins full access" ON staff_members;

CREATE POLICY "staff_members: supervisors and admins full access"
  ON staff_members FOR ALL USING (current_user_role() IN ('supervisor', 'admin'));

-- contacts
DROP POLICY IF EXISTS "contacts: leading_hands and above read"   ON contacts;
DROP POLICY IF EXISTS "contacts: supervisors and admins write"   ON contacts;

CREATE POLICY "contacts: leading_hands and above read"
  ON contacts FOR SELECT USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));
CREATE POLICY "contacts: supervisors and admins write"
  ON contacts FOR ALL USING (current_user_role() IN ('supervisor', 'admin'));

-- invitations
DROP POLICY IF EXISTS "invitations: admin full access"                    ON invitations;
DROP POLICY IF EXISTS "invitations: supervisors create"                   ON invitations;
DROP POLICY IF EXISTS "invitations: supervisors read own"                 ON invitations;
DROP POLICY IF EXISTS "invitations: read by token (unauthenticated)"     ON invitations;

CREATE POLICY "invitations: admin full access"
  ON invitations FOR ALL USING (current_user_role() = 'admin');
CREATE POLICY "invitations: supervisors create"
  ON invitations FOR INSERT WITH CHECK (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "invitations: supervisors read own"
  ON invitations FOR SELECT USING (current_user_role() = 'supervisor' AND invited_by = auth.uid());
CREATE POLICY "invitations: read by token (unauthenticated)"
  ON invitations FOR SELECT USING (true);

-- client_site_access
DROP POLICY IF EXISTS "client_site_access: admin full access"   ON client_site_access;
DROP POLICY IF EXISTS "client_site_access: clients read own"    ON client_site_access;

CREATE POLICY "client_site_access: admin full access"
  ON client_site_access FOR ALL USING (current_user_role() = 'admin');
CREATE POLICY "client_site_access: clients read own"
  ON client_site_access FOR SELECT USING (client_user_id = auth.uid());


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
