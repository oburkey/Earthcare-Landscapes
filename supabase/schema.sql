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


-- ── 3b. Additional tables & columns (consolidated from supabase/migration_*.sql) ──
-- The blocks below were originally applied via separate migration files and are
-- merged here so this file is a complete, idempotent single source of truth.

-- Site plan photo columns (from migration_photos.sql)
ALTER TABLE sites  ADD COLUMN IF NOT EXISTS site_plan_path text;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS site_plan_path text;


-- Vehicles (from migration_vehicles.sql, plus vehicle_type / current_hours additions)
CREATE TABLE IF NOT EXISTS vehicles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  make                   text,           -- nullable: trailers use `name` instead
  model                  text,           -- nullable: trailers use `name` instead
  name                   text,           -- trailers only, e.g. "Plant trailer 1"
  year                   int,
  registration           text,
  assigned_to            text,           -- staff member name or site name
  vehicle_type           text,           -- 'Truck' | 'Machinery' | 'Ute' | 'Trailer'

  -- Registration & insurance
  rego_expiry_date       date,
  insurance_expiry_date  date,

  -- Service history
  last_service_date      date,
  last_service_hours     numeric(10, 1), -- engine hours at last service
  last_service_odometer  int,            -- odometer km at last service

  -- Next service due
  next_service_due_date  date,
  next_service_km        int,            -- odometer km target
  next_service_hours     numeric(10, 1), -- engine hours target

  -- Current hours (machinery only)
  current_hours             numeric(10, 1),
  current_hours_updated_at  timestamptz,

  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Column additions for installs created before the above CREATE TABLE included them.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_hours numeric(10, 1);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_hours_updated_at timestamptz;
-- NOTE: current_hours / current_hours_updated_at were applied to the live database
-- without a tracked migration file — included here so schema.sql stays accurate.

-- Trailer support (from migration_trailers.sql)
ALTER TABLE vehicles ALTER COLUMN make  DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN model DROP NOT NULL;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles: supervisors and admins full access" ON vehicles;
CREATE POLICY "vehicles: supervisors and admins full access"
  ON vehicles FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

-- Workers and leading_hand read access (applied directly in Supabase; documented here for schema accuracy)
DROP POLICY IF EXISTS "vehicles: all staff can read" ON vehicles;
CREATE POLICY "vehicles: all staff can read"
  ON vehicles FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Leading hands can edit vehicle details (from migration_vehicles_leading_hand_update.sql)
DROP POLICY IF EXISTS "vehicles: leading_hand can update" ON vehicles;
CREATE POLICY "vehicles: leading_hand can update"
  ON vehicles FOR UPDATE
  USING (current_user_role() = 'leading_hand')
  WITH CHECK (current_user_role() = 'leading_hand');


-- Quote template sections (from migration_phase2.sql)
CREATE TABLE IF NOT EXISTS quote_template_sections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  order_index     integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  is_client_extra boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quote_template_sections ADD COLUMN IF NOT EXISTS is_client_extra boolean NOT NULL DEFAULT false;

ALTER TABLE quote_template_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qts: internal users read" ON quote_template_sections;
CREATE POLICY "qts: internal users read"
  ON quote_template_sections FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "qts: admin write" ON quote_template_sections;
CREATE POLICY "qts: admin write"
  ON quote_template_sections FOR ALL
  USING (current_user_role() = 'admin');


-- Quote template items (from migration_phase2.sql)
-- unit values: 'No.' | 'm²' | 'm³' | 'Lin M' | 'toggle' | 'auto'
-- plant_category drives irrigation auto-calc: 'front' = Softscape Front plants,
--   'rear' = Softscape Rear plants. NULL = not a plant item.
-- auto_calc_formula: 'front_plants' | 'rear_plants' | 'all_plants' | 'all_plants_x0.5'
CREATE TABLE IF NOT EXISTS quote_template_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id         uuid NOT NULL REFERENCES quote_template_sections(id) ON DELETE CASCADE,
  name               text NOT NULL,
  unit               text NOT NULL DEFAULT 'No.',
  unit_price         numeric(10,2),
  is_auto_calculated boolean NOT NULL DEFAULT false,
  auto_calc_formula  text,
  plant_category     text CHECK (plant_category IN ('front', 'rear')),
  order_index        integer NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qti_section_id_idx ON quote_template_items(section_id);

ALTER TABLE quote_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qti: internal users read" ON quote_template_items;
CREATE POLICY "qti: internal users read"
  ON quote_template_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "qti: admin write" ON quote_template_items;
CREATE POLICY "qti: admin write"
  ON quote_template_items FOR ALL
  USING (current_user_role() = 'admin');


-- Lot quotes (from migration_phase2.sql)
-- is_estimated = true  → pre-job estimate (filled before works start)
-- is_estimated = false → final actual quantities (filled on completion)
-- One of each type per lot, enforced by the unique constraint.
CREATE TABLE IF NOT EXISTS lot_quotes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id       uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  is_estimated boolean NOT NULL DEFAULT true,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  quoted_by    uuid REFERENCES profiles(id),
  quoted_at    timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lot_id, is_estimated)
);

CREATE INDEX IF NOT EXISTS lot_quotes_lot_id_idx ON lot_quotes(lot_id);

DROP TRIGGER IF EXISTS lot_quotes_updated_at ON lot_quotes;
CREATE TRIGGER lot_quotes_updated_at
  BEFORE UPDATE ON lot_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE lot_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_quotes: leading_hand+ access" ON lot_quotes;
CREATE POLICY "lot_quotes: leading_hand+ access"
  ON lot_quotes FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));


-- Lot quote items (from migration_phase2.sql)
-- item_name / unit / unit_price_snapshot are snapshots taken at save time so
-- historical quotes remain accurate if the template is later changed.
CREATE TABLE IF NOT EXISTS lot_quote_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            uuid NOT NULL REFERENCES lot_quotes(id) ON DELETE CASCADE,
  template_item_id    uuid REFERENCES quote_template_items(id),
  item_name           text NOT NULL,
  unit                text NOT NULL,
  quantity            numeric(10,3),
  unit_price_snapshot numeric(10,2),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, template_item_id)
);

CREATE INDEX IF NOT EXISTS lqi_quote_id_idx ON lot_quote_items(quote_id);

ALTER TABLE lot_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_quote_items: leading_hand+ access" ON lot_quote_items;
CREATE POLICY "lot_quote_items: leading_hand+ access"
  ON lot_quote_items FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));


-- Default quote template seed — only runs if no sections exist yet (from migration_phase2.sql)
DO $$
DECLARE
  s_earthworks      uuid;
  s_hardscape       uuid;
  s_softscape_front uuid;
  s_softscape_rear  uuid;
  s_irrigation      uuid;
  s_client_extras   uuid;
BEGIN

  IF EXISTS (SELECT 1 FROM quote_template_sections LIMIT 1) THEN
    RETURN;
  END IF;

  -- Sections
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Earthworks', 0)             RETURNING id INTO s_earthworks;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Hardscape Works', 1)         RETURNING id INTO s_hardscape;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Softscape Front', 2)         RETURNING id INTO s_softscape_front;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Softscape Rear & Side', 3)   RETURNING id INTO s_softscape_rear;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Irrigation', 4)              RETURNING id INTO s_irrigation;
  INSERT INTO quote_template_sections (name, order_index, is_client_extra) VALUES ('Client Extras', 5, true) RETURNING id INTO s_client_extras;

  -- Earthworks
  INSERT INTO quote_template_items (section_id, name, unit, order_index) VALUES
    (s_earthworks, 'Fine grading',          'm²',  0),
    (s_earthworks, 'Extra earthworks',      'm²',  1),
    (s_earthworks, 'Extra works/comment',   'No.', 2);

  -- Hardscape Works
  INSERT INTO quote_template_items (section_id, name, unit, order_index) VALUES
    (s_hardscape, 'Moss rock installed',          'Lin M', 0),
    (s_hardscape, 'Steppers 600x300mm',           'No.',   1),
    (s_hardscape, 'Large boulders',               'No.',   2),
    (s_hardscape, 'Small pitching',               'Lin M', 3),
    (s_hardscape, 'Steel edging to mulch areas',  'Lin M', 4);

  -- Softscape Front (plant items tagged with plant_category = 'front')
  INSERT INTO quote_template_items (section_id, name, unit, plant_category, order_index) VALUES
    (s_softscape_front, '130mm plants',                      'No.',   'front', 0),
    (s_softscape_front, '175-200mm plants',                  'No.',   'front', 1),
    (s_softscape_front, '300mm pot plants',                  'No.',   'front', 2),
    (s_softscape_front, 'Street tree 90L',                   'No.',   null,    3),
    (s_softscape_front, 'Street tree 35Lt',                  'No.',   null,    4),
    (s_softscape_front, 'Artificial turf',                   'm²',    null,    5),
    (s_softscape_front, 'Steel edging to turf',              'Lin M', null,    6),
    (s_softscape_front, 'Mulch - Limestone 32mm',            'm²',    null,    7),
    (s_softscape_front, 'Mulch - Red gravel',                'm²',    null,    8),
    (s_softscape_front, 'Mulch - Black',                     'm²',    null,    9),
    (s_softscape_front, 'Mulch - Grey',                      'm²',    null,    10),
    (s_softscape_front, 'Rock mulch around A/C and services','No.',   null,    11),
    (s_softscape_front, 'Other',                             'No.',   null,    12);

  -- Softscape Rear & Side
  -- 'Corner lot' uses unit='toggle' — renders as YES/NO, value stored as 1/0
  INSERT INTO quote_template_items (section_id, name, unit, plant_category, order_index) VALUES
    (s_softscape_rear, 'Corner lot',                      'toggle', null,   0),
    (s_softscape_rear, '130mm plants',                    'No.',    'rear', 1),
    (s_softscape_rear, '175-200mm plants',                'No.',    'rear', 2),
    (s_softscape_rear, '300mm pot plants',                'No.',    'rear', 3),
    (s_softscape_rear, 'Other larger plant stock - size', 'No.',    'rear', 4),
    (s_softscape_rear, 'Limestone stone mulch',           'm²',     null,   5),
    (s_softscape_rear, 'Black mulch',                     'm²',     null,   6),
    (s_softscape_rear, 'Steppers 600x300mm',              'No.',    null,   7),
    (s_softscape_rear, 'Small tree - size and type',      'No.',    null,   8),
    (s_softscape_rear, 'Other',                           'No.',    null,   9);

  -- Irrigation — all auto-calculated, read-only in the form
  INSERT INTO quote_template_items (section_id, name, unit, is_auto_calculated, auto_calc_formula, order_index) VALUES
    (s_irrigation, 'Front drippers',        'No.',   true, 'front_plants',    0),
    (s_irrigation, 'Back drippers',         'No.',   true, 'rear_plants',     1),
    (s_irrigation, 'Jabs',                  'No.',   true, 'all_plants',      2),
    (s_irrigation, 'Dripper tube estimate', 'Lin M', true, 'all_plants_x0.5', 3);

  -- Client Extras
  INSERT INTO quote_template_items (section_id, name, unit, order_index) VALUES
    (s_client_extras, 'Artificial turf rear', 'm²',    0),
    (s_client_extras, 'Steel edging to turf', 'Lin M', 1),
    (s_client_extras, 'Other',                'No.',   2);

END $$;


-- Plant ratio settings (from migration_plant_ratio_settings.sql)
CREATE TABLE IF NOT EXISTS plant_ratio_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid REFERENCES sites(id) ON DELETE CASCADE,
  front_ratio     numeric NOT NULL DEFAULT 2.0,
  rear_ratio      numeric NOT NULL DEFAULT 1.75,
  pot_size_split  jsonb NOT NULL DEFAULT '{"130mm": 75, "200mm": 25}',
  updated_by      uuid REFERENCES profiles(id),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plant_ratio_settings_site_id_unique
  ON plant_ratio_settings (site_id) WHERE site_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS plant_ratio_settings_global_unique
  ON plant_ratio_settings ((true)) WHERE site_id IS NULL;

DROP TRIGGER IF EXISTS plant_ratio_settings_updated_at ON plant_ratio_settings;
CREATE TRIGGER plant_ratio_settings_updated_at
  BEFORE UPDATE ON plant_ratio_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE plant_ratio_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_ratio_settings: staff read all" ON plant_ratio_settings;
CREATE POLICY "plant_ratio_settings: staff read all"
  ON plant_ratio_settings FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "plant_ratio_settings: admin write" ON plant_ratio_settings;
CREATE POLICY "plant_ratio_settings: admin write"
  ON plant_ratio_settings FOR ALL
  USING (current_user_role() = 'admin');


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
DROP POLICY IF EXISTS "profiles: all staff read all"               ON profiles;

CREATE POLICY "profiles: read own"
  ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: supervisors and admins read all"
  ON profiles FOR SELECT USING (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles: admin update all"
  ON profiles FOR UPDATE USING (current_user_role() = 'admin');
-- Applied directly in Supabase this session; supersedes the supervisors/admins
-- policy above but both are left in place (RLS policies are OR'd).
CREATE POLICY "profiles: all staff read all"
  ON profiles FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

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
DROP POLICY IF EXISTS "contacts: all staff read"                 ON contacts;
DROP POLICY IF EXISTS "contacts: supervisors and admins write"   ON contacts;

-- Widened from leading_hand+ to worker+ so the Contacts nav item is usable by workers.
CREATE POLICY "contacts: all staff read"
  ON contacts FOR SELECT USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
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


-- ── Site completion ───────────────────────────────────────────────────────────
ALTER TABLE sites ADD COLUMN IF NOT EXISTS completed_at timestamptz;


-- ── Client extras toggles ─────────────────────────────────────────────────────
ALTER TABLE sites ADD COLUMN IF NOT EXISTS has_client_extras boolean NOT NULL DEFAULT true;
ALTER TABLE lots  ADD COLUMN IF NOT EXISTS has_client_extras boolean NOT NULL DEFAULT true;


-- ── Extra job pricing ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extra_job_quote_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_job_id     uuid NOT NULL REFERENCES extra_jobs(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES quote_template_items(id),
  description      text,
  unit             text NOT NULL DEFAULT 'hr',
  quantity         numeric(10,3),
  unit_price       numeric(10,2),
  item_type        text NOT NULL DEFAULT 'template',
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extra_job_quote_items_extra_job_id_idx ON extra_job_quote_items(extra_job_id);
ALTER TABLE extra_job_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ejqi: leading_hand+ access" ON extra_job_quote_items;
DROP POLICY IF EXISTS "ejqi: workers read"          ON extra_job_quote_items;

CREATE POLICY "ejqi: leading_hand+ access"
  ON extra_job_quote_items FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));
CREATE POLICY "ejqi: workers read"
  ON extra_job_quote_items FOR SELECT
  USING (current_user_role() = 'worker');


-- ── Stage completion ──────────────────────────────────────────────────────────
ALTER TABLE stages ADD COLUMN IF NOT EXISTS completed_at timestamptz;


-- ── Quote template section type flag ─────────────────────────────────────────
ALTER TABLE quote_template_sections ADD COLUMN IF NOT EXISTS is_client_extra boolean NOT NULL DEFAULT false;
UPDATE quote_template_sections SET is_client_extra = true WHERE name = 'Client Extras';


-- ── Lot status flags ──────────────────────────────────────────────────────────
ALTER TABLE lots ADD COLUMN IF NOT EXISTS build_complete boolean NOT NULL DEFAULT false;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS quant_done     boolean NOT NULL DEFAULT false;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS invoiced       boolean NOT NULL DEFAULT false;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS build_completed_at timestamptz;


-- ── Vehicle type ──────────────────────────────────────────────────────────────
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type text;


-- ── Multiple site plan documents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_plan_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  label        text,
  uploaded_by  uuid NOT NULL REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_plan_documents_site_id_idx ON site_plan_documents(site_id);
ALTER TABLE site_plan_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_plan_documents: staff read all"      ON site_plan_documents;
DROP POLICY IF EXISTS "site_plan_documents: admin manage"        ON site_plan_documents;
DROP POLICY IF EXISTS "site_plan_documents: clients read permitted" ON site_plan_documents;

CREATE POLICY "site_plan_documents: staff read all"
  ON site_plan_documents FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "site_plan_documents: admin manage"
  ON site_plan_documents FOR ALL
  USING (current_user_role() = 'admin');
CREATE POLICY "site_plan_documents: clients read permitted"
  ON site_plan_documents FOR SELECT
  USING (
    current_user_role() = 'client'
    AND site_id IN (
      SELECT csa.site_id FROM client_site_access csa WHERE csa.client_user_id = auth.uid()
    )
  );


-- ── Lot trade status ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lot_trade_status (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id                uuid NOT NULL UNIQUE REFERENCES lots(id) ON DELETE CASCADE,
  trades_completed      text[] NOT NULL DEFAULT '{}',
  ready_for_landscaping boolean NOT NULL DEFAULT false,
  blocking_notes        text,
  updated_by            uuid REFERENCES profiles(id),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS lot_trade_status_updated_at ON lot_trade_status;
CREATE TRIGGER lot_trade_status_updated_at
  BEFORE UPDATE ON lot_trade_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE lot_trade_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_trade_status: staff read all"          ON lot_trade_status;
DROP POLICY IF EXISTS "lot_trade_status: leading_hand+ write"      ON lot_trade_status;
DROP POLICY IF EXISTS "lot_trade_status: clients read permitted"   ON lot_trade_status;

CREATE POLICY "lot_trade_status: staff read all"
  ON lot_trade_status FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "lot_trade_status: leading_hand+ write"
  ON lot_trade_status FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));
CREATE POLICY "lot_trade_status: clients read permitted"
  ON lot_trade_status FOR SELECT
  USING (
    current_user_role() = 'client'
    AND lot_id IN (
      SELECT l.id FROM lots l
      JOIN stages s ON s.id = l.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );


-- ── Lot completion checklist ──────────────────────────────────────────────────
ALTER TABLE lots ADD COLUMN IF NOT EXISTS extras_notes text;

CREATE TABLE IF NOT EXISTS lot_checklist_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id         uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  section        text NOT NULL CHECK (section IN ('pre_checks', 'landscaping_works', 'finishing')),
  item_key       text NOT NULL,
  completed      boolean NOT NULL DEFAULT false,
  response       text CHECK (response IN ('yes', 'no')),
  completed_date date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lot_id, item_key)
);

DROP TRIGGER IF EXISTS lot_checklist_items_updated_at ON lot_checklist_items;
CREATE TRIGGER lot_checklist_items_updated_at
  BEFORE UPDATE ON lot_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE lot_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_checklist_items: staff read all"        ON lot_checklist_items;
DROP POLICY IF EXISTS "lot_checklist_items: leading_hand+ write"    ON lot_checklist_items;
DROP POLICY IF EXISTS "lot_checklist_items: clients read permitted" ON lot_checklist_items;

CREATE POLICY "lot_checklist_items: staff read all"
  ON lot_checklist_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "lot_checklist_items: leading_hand+ write"
  ON lot_checklist_items FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));
CREATE POLICY "lot_checklist_items: clients read permitted"
  ON lot_checklist_items FOR SELECT
  USING (
    current_user_role() = 'client'
    AND lot_id IN (
      SELECT l.id FROM lots l
      JOIN stages s ON s.id = l.stage_id
      JOIN client_site_access csa ON csa.site_id = s.site_id
      WHERE csa.client_user_id = auth.uid()
    )
  );


-- ── Toolbox meetings ──────────────────────────────────────────────────────────
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

ALTER TABLE toolbox_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "toolbox_meetings: staff read all"     ON toolbox_meetings;
DROP POLICY IF EXISTS "toolbox_meetings: leading_hand+ write" ON toolbox_meetings;

CREATE POLICY "toolbox_meetings: staff read all"
  ON toolbox_meetings FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "toolbox_meetings: leading_hand+ write"
  ON toolbox_meetings FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));


-- ── Trailer support on pre_starts (from migration_trailers.sql) ───────────────
-- NOTE: pre_starts itself is not defined in this file (created directly in the
-- Supabase dashboard, columns inferred from application code). This mirrors
-- the existing machine_id / truck_id columns.
ALTER TABLE pre_starts
  ADD COLUMN IF NOT EXISTS trailer_id uuid REFERENCES vehicles(id) ON DELETE SET NULL;


-- ── pre_starts: admin update policy (from migration_prestarts_admin_update.sql) ─
-- No policy previously granted admins UPDATE access, so admin edits (e.g. to
-- the date field) silently matched zero rows and never persisted.
ALTER TABLE pre_starts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pre_starts: admin update all" ON pre_starts;
CREATE POLICY "pre_starts: admin update all"
  ON pre_starts FOR UPDATE
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- ── pre_starts: insert + read-own policies (applied directly in Supabase this
-- session, documented here for schema accuracy) ────────────────────────────
DROP POLICY IF EXISTS "pre_starts: all staff can insert" ON pre_starts;
CREATE POLICY "pre_starts: all staff can insert"
  ON pre_starts FOR INSERT
  WITH CHECK (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "pre_starts: staff read own" ON pre_starts;
CREATE POLICY "pre_starts: staff read own"
  ON pre_starts FOR SELECT
  USING (submitted_by = auth.uid());

-- ── pre_starts: admin delete policy (from migration_prestarts_admin_delete.sql) ─
-- No policy previously granted admins DELETE access, so admin deletes silently
-- matched zero rows and the record reappeared after the next page load.
DROP POLICY IF EXISTS "pre_starts: admin delete all" ON pre_starts;
CREATE POLICY "pre_starts: admin delete all"
  ON pre_starts FOR DELETE
  USING (current_user_role() = 'admin');


-- ── Extra jobs invoicing flags (from migration_extra_jobs_invoicing.sql) ──────
-- Same toggle flow as lots.pending_review / approved_for_invoicing / invoiced.
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS pending_review boolean NOT NULL DEFAULT false;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS approved_for_invoicing boolean NOT NULL DEFAULT false;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS invoiced boolean NOT NULL DEFAULT false;


-- ── Home design (from migration_lots_home_design.sql) ─────────────────────────
ALTER TABLE lots ADD COLUMN IF NOT EXISTS home_design text;


-- ── House Types catalogue (from migration_house_types.sql) ────────────────────
CREATE TABLE IF NOT EXISTS house_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer       text NOT NULL DEFAULT 'Providence',
  name            text NOT NULL,
  size            text NOT NULL CHECK (size IN ('S', 'M', 'L')),
  site_area       numeric(8, 2),
  turf_area       numeric(8, 2),
  softworks_area  numeric(8, 2),
  alfresco_area   numeric(8, 2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (developer, name)
);

DROP TRIGGER IF EXISTS house_types_updated_at ON house_types;
CREATE TRIGGER house_types_updated_at
  BEFORE UPDATE ON house_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE house_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house_types: admin full access" ON house_types;
CREATE POLICY "house_types: admin full access"
  ON house_types FOR ALL
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "house_types: staff read" ON house_types;
CREATE POLICY "house_types: staff read"
  ON house_types FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));


-- =============================================================================
-- 3c. Consolidated from migrations added after 2026-07-22
-- Structure only (tables, columns, constraints, indexes, triggers, RLS, views).
-- One-off data fixes, backfills and seed rows from those migrations are NOT
-- repeated here — see the migration files themselves for those:
--   quant_sheet_changes, corner_lot_merge, checklist_yesno_to_checkbox,
--   front_rear_pot_split (5L → 200mm rename), materials_categories_restructure
--   (unit renames), quote_sections (line_items backfill), budget_quant_sheet
--   (quote_type backfill), flexible_stock_system (site_stock data copy +
--   material_types seed), materials_orders / materials_conversion_links /
--   quote_presets (seed rows).
-- =============================================================================


-- ── Contract pricing (from migration_contract_pricing.sql) ────────────────────
ALTER TABLE stages ADD COLUMN IF NOT EXISTS is_contract_pricing    boolean NOT NULL DEFAULT false;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS default_contract_price numeric(10,2);
ALTER TABLE lots   ADD COLUMN IF NOT EXISTS contract_price         numeric(10,2);


-- ── Lot / extra job status columns ───────────────────────────────────────────
-- delayed / delay_reason (migration_delayed_status.sql)
ALTER TABLE lots       ADD COLUMN IF NOT EXISTS delayed      boolean NOT NULL DEFAULT false;
ALTER TABLE lots       ADD COLUMN IF NOT EXISTS delay_reason text;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS delayed      boolean NOT NULL DEFAULT false;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS delay_reason text;

-- expected_completion_date (migration_prices_delays_photos_species.sql)
ALTER TABLE lots       ADD COLUMN IF NOT EXISTS expected_completion_date date;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS expected_completion_date date;

-- extra_jobs.due_date (migration_extra_job_due_date.sql)
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS due_date date;

-- extra_jobs.approved_by_name — free text, not a profiles FK
-- (migration_extra_jobs_approved_by.sql)
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS approved_by_name text;

-- extra_jobs.finance_notes (migration_extra_job_finance_notes.sql)
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS finance_notes text;

-- lots.updated_by / lot_checklist_items.completed_by
-- (migration_lot_activity_attribution.sql)
ALTER TABLE lots                ADD COLUMN IF NOT EXISTS updated_by   uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE lot_checklist_items ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- lots.is_corner (migration_lot_corner_flag.sql)
ALTER TABLE lots ADD COLUMN IF NOT EXISTS is_corner boolean NOT NULL DEFAULT false;

-- approved_for_invoicing_at (migration_quant_issues.sql)
ALTER TABLE lots       ADD COLUMN IF NOT EXISTS approved_for_invoicing_at timestamptz;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS approved_for_invoicing_at timestamptz;


-- ── Photo notes + categories (from migration_prices_delays_photos_species.sql) ─
ALTER TABLE lot_photos       ADD COLUMN IF NOT EXISTS notes          text;
ALTER TABLE lot_photos       ADD COLUMN IF NOT EXISTS photo_category text;
ALTER TABLE extra_job_photos ADD COLUMN IF NOT EXISTS notes          text;
ALTER TABLE extra_job_photos ADD COLUMN IF NOT EXISTS photo_category text;

DO $$ BEGIN
  ALTER TABLE lot_photos ADD CONSTRAINT lot_photos_photo_category_check
    CHECK (photo_category IS NULL OR photo_category IN ('hardscape', 'softscape', 'issue', 'general'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE extra_job_photos ADD CONSTRAINT extra_job_photos_photo_category_check
    CHECK (photo_category IS NULL OR photo_category IN ('hardscape', 'softscape', 'issue', 'general'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── Plant ratio front/rear pot splits (from migration_front_rear_pot_split.sql) ─
ALTER TABLE plant_ratio_settings ADD COLUMN IF NOT EXISTS front_pot_split jsonb NOT NULL DEFAULT '{"130mm": 75, "200mm": 25}'::jsonb;
ALTER TABLE plant_ratio_settings ADD COLUMN IF NOT EXISTS rear_pot_split  jsonb NOT NULL DEFAULT '{"130mm": 75, "200mm": 25}'::jsonb;


-- ── Incidents (from migration_incidents.sql) ──────────────────────────────────
-- reported_by / uploaded_by are nullable + ON DELETE SET NULL per
-- migration_profile_fk_set_null.sql.
CREATE TABLE IF NOT EXISTS incidents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date             date        NOT NULL,
  time             time,
  type             text        NOT NULL CHECK (type IN ('incident', 'near_miss', 'first_aid', 'property_damage')),
  description      text        NOT NULL,
  people_involved  text,
  immediate_action text,
  reported_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  admin_notes      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  uploaded_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incidents_site_id_idx           ON incidents(site_id);
CREATE INDEX IF NOT EXISTS incidents_date_idx              ON incidents(date);
CREATE INDEX IF NOT EXISTS incidents_type_idx              ON incidents(type);
CREATE INDEX IF NOT EXISTS incident_photos_incident_id_idx ON incident_photos(incident_id);

ALTER TABLE incidents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidents: staff read all" ON incidents;
CREATE POLICY "incidents: staff read all"
  ON incidents FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "incidents: leading_hand+ insert" ON incidents;
CREATE POLICY "incidents: leading_hand+ insert"
  ON incidents FOR INSERT
  WITH CHECK (
    reported_by = auth.uid()
    AND current_user_role() IN ('leading_hand', 'supervisor', 'admin')
  );

DROP POLICY IF EXISTS "incidents: admin update" ON incidents;
CREATE POLICY "incidents: admin update"
  ON incidents FOR UPDATE
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS "incidents: admin delete" ON incidents;
CREATE POLICY "incidents: admin delete"
  ON incidents FOR DELETE
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "incident_photos: staff read all" ON incident_photos;
CREATE POLICY "incident_photos: staff read all"
  ON incident_photos FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "incident_photos: leading_hand+ insert" ON incident_photos;
CREATE POLICY "incident_photos: leading_hand+ insert"
  ON incident_photos FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND current_user_role() IN ('leading_hand', 'supervisor', 'admin')
  );

DROP POLICY IF EXISTS "incident_photos: admin delete" ON incident_photos;
CREATE POLICY "incident_photos: admin delete"
  ON incident_photos FOR DELETE
  USING (current_user_role() = 'admin');


-- ── Quotes (from migration_quote_conversion.sql, migration_quote_fk_fix.sql) ──
-- line_items is deprecated (replaced by quote_sections / quote_line_items
-- below) but still exists in the database — not dropped.
-- created_by is nullable + ON DELETE SET NULL per migration_profile_fk_set_null.sql.
CREATE TABLE IF NOT EXISTS quotes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid REFERENCES sites(id),
  stage_id    uuid REFERENCES stages(id),
  reference   text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'draft',
  line_items  jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes       text NOT NULL DEFAULT '',
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES stages(id);

DROP TRIGGER IF EXISTS quotes_updated_at ON quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes: supervisor+ full access" ON quotes;
CREATE POLICY "quotes: supervisor+ full access"
  ON quotes FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

-- Extra jobs converted from a quote. Deleting the quote nulls the link.
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS source_quote_id uuid;
ALTER TABLE extra_jobs DROP CONSTRAINT IF EXISTS extra_jobs_source_quote_id_fkey;
ALTER TABLE extra_jobs ADD CONSTRAINT extra_jobs_source_quote_id_fkey
  FOREIGN KEY (source_quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS extra_jobs_source_quote_id_idx ON extra_jobs(source_quote_id);


-- ── Quote sections + line items (from migration_quote_sections.sql,
--    migration_quote_section_exclude_from_total.sql) ─────────────────────────
-- exclude_from_total = section sits below the builder's total divider
-- (optional items, not counted in the quote total).
CREATE TABLE IF NOT EXISTS quote_sections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id           uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  name               text NOT NULL,
  order_index        integer NOT NULL DEFAULT 0,
  exclude_from_total boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE quote_sections ADD COLUMN IF NOT EXISTS exclude_from_total boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS quote_sections_quote_id_idx ON quote_sections(quote_id);

ALTER TABLE quote_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_sections: supervisor+ full access" ON quote_sections;
CREATE POLICY "quote_sections: supervisor+ full access"
  ON quote_sections FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

CREATE TABLE IF NOT EXISTS quote_line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES quote_sections(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  qty         numeric(10,3) NOT NULL DEFAULT 0,
  unit        text NOT NULL DEFAULT 'hr',
  rate        numeric(10,2) NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_line_items_section_id_idx ON quote_line_items(section_id);

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_line_items: supervisor+ full access" ON quote_line_items;
CREATE POLICY "quote_line_items: supervisor+ full access"
  ON quote_line_items FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));


-- ── Quote presets — /quotes builder templates (from migration_quote_presets.sql,
--    migration_quote_section_exclude_from_total.sql) ─────────────────────────
-- Not the same as quote_template_* above (those drive the per-lot quant sheet).
CREATE TABLE IF NOT EXISTS quote_presets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_default  boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_presets: internal users read" ON quote_presets;
CREATE POLICY "quote_presets: internal users read"
  ON quote_presets FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "quote_presets: admin write" ON quote_presets;
CREATE POLICY "quote_presets: admin write"
  ON quote_presets FOR ALL
  USING (current_user_role() = 'admin');

CREATE TABLE IF NOT EXISTS quote_preset_sections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id          uuid NOT NULL REFERENCES quote_presets(id) ON DELETE CASCADE,
  name               text NOT NULL DEFAULT '',
  order_index        integer NOT NULL DEFAULT 0,
  exclude_from_total boolean NOT NULL DEFAULT false
);
ALTER TABLE quote_preset_sections ADD COLUMN IF NOT EXISTS exclude_from_total boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS qpts_preset_id_idx ON quote_preset_sections(preset_id);

ALTER TABLE quote_preset_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_preset_sections: internal users read" ON quote_preset_sections;
CREATE POLICY "quote_preset_sections: internal users read"
  ON quote_preset_sections FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "quote_preset_sections: admin write" ON quote_preset_sections;
CREATE POLICY "quote_preset_sections: admin write"
  ON quote_preset_sections FOR ALL
  USING (current_user_role() = 'admin');

CREATE TABLE IF NOT EXISTS quote_preset_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES quote_preset_sections(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  qty         numeric NOT NULL DEFAULT 1,
  unit        text NOT NULL DEFAULT '',
  rate        numeric NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS qpti_section_id_idx ON quote_preset_items(section_id);

ALTER TABLE quote_preset_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_preset_items: internal users read" ON quote_preset_items;
CREATE POLICY "quote_preset_items: internal users read"
  ON quote_preset_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "quote_preset_items: admin write" ON quote_preset_items;
CREATE POLICY "quote_preset_items: admin write"
  ON quote_preset_items FOR ALL
  USING (current_user_role() = 'admin');


-- ── Lot quotes: quote_type + estimate admin-only (from
--    migration_budget_quant_sheet.sql, migration_lot_quotes_last_edited.sql) ─
-- quote_type is the source of truth ('budget' is retired: rows kept, never
-- shown or saved). is_estimated is kept, not dropped.
ALTER TABLE lot_quotes ADD COLUMN IF NOT EXISTS quote_type text NOT NULL DEFAULT 'final';
ALTER TABLE lot_quotes ALTER COLUMN quote_type SET DEFAULT 'final';
ALTER TABLE lot_quotes DROP CONSTRAINT IF EXISTS lot_quotes_quote_type_check;
ALTER TABLE lot_quotes ADD CONSTRAINT lot_quotes_quote_type_check
  CHECK (quote_type IN ('estimate', 'budget', 'final'));

ALTER TABLE lot_quotes DROP CONSTRAINT IF EXISTS lot_quotes_lot_id_is_estimated_key;
ALTER TABLE lot_quotes DROP CONSTRAINT IF EXISTS lot_quotes_lot_id_quote_type_key;
ALTER TABLE lot_quotes ADD CONSTRAINT lot_quotes_lot_id_quote_type_key UNIQUE (lot_id, quote_type);

ALTER TABLE lot_quotes ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE lot_quotes ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- Replaces "lot_quotes: leading_hand+ access" / "lot_quote_items: leading_hand+
-- access" created earlier in this file.
DROP POLICY IF EXISTS "lot_quotes: leading_hand+ access"                ON lot_quotes;
DROP POLICY IF EXISTS "lot_quotes: leading_hand+ access to budget/final" ON lot_quotes;
DROP POLICY IF EXISTS "lot_quotes: admin access to estimate"            ON lot_quotes;

CREATE POLICY "lot_quotes: leading_hand+ access to budget/final"
  ON lot_quotes FOR ALL
  USING (
    quote_type <> 'estimate'
    AND current_user_role() IN ('leading_hand', 'supervisor', 'admin')
  );

CREATE POLICY "lot_quotes: admin access to estimate"
  ON lot_quotes FOR ALL
  USING (
    quote_type = 'estimate'
    AND current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "lot_quote_items: leading_hand+ access"                ON lot_quote_items;
DROP POLICY IF EXISTS "lot_quote_items: leading_hand+ access to budget/final" ON lot_quote_items;
DROP POLICY IF EXISTS "lot_quote_items: admin access to estimate"            ON lot_quote_items;

CREATE POLICY "lot_quote_items: leading_hand+ access to budget/final"
  ON lot_quote_items FOR ALL
  USING (
    current_user_role() IN ('leading_hand', 'supervisor', 'admin')
    AND EXISTS (
      SELECT 1 FROM lot_quotes q
      WHERE q.id = lot_quote_items.quote_id AND q.quote_type <> 'estimate'
    )
  );

CREATE POLICY "lot_quote_items: admin access to estimate"
  ON lot_quote_items FOR ALL
  USING (
    current_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM lot_quotes q
      WHERE q.id = lot_quote_items.quote_id AND q.quote_type = 'estimate'
    )
  );


-- ── Materials: orders, conversion settings + links (from
--    migration_materials_orders.sql, migration_materials_orders_rls_fix.sql,
--    migration_materials_categories_restructure.sql,
--    migration_materials_conversion_links.sql,
--    migration_prices_delays_photos_species.sql) ─────────────────────────────
CREATE TABLE IF NOT EXISTS material_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  supplier_id     uuid REFERENCES contacts(id) ON DELETE SET NULL,
  order_date      date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date   date,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'ordered', 'on_hold', 'delivered')),
  notes           text,
  invoice_amount  numeric(10,2),
  delivered_at    timestamptz,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS material_orders_updated_at ON material_orders;
CREATE TRIGGER material_orders_updated_at
  BEFORE UPDATE ON material_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- category is free text validated by the app (the original CHECK was dropped
-- by migration_materials_categories_restructure.sql). plant_type is info
-- only. stock_field names the material a suggestion-added line item updates.
CREATE TABLE IF NOT EXISTS material_order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  category     text NOT NULL,
  description  text NOT NULL DEFAULT '',
  quantity     numeric NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT '',
  unit_price   numeric(10,2),
  notes        text,
  order_index  int NOT NULL DEFAULT 0,
  plant_type   text,
  stock_field  text
);
ALTER TABLE material_order_items DROP CONSTRAINT IF EXISTS material_order_items_category_check;
ALTER TABLE material_order_items ADD COLUMN IF NOT EXISTS plant_type  text;
ALTER TABLE material_order_items ADD COLUMN IF NOT EXISTS stock_field text;

CREATE TABLE IF NOT EXISTS material_order_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES material_orders(id) ON DELETE CASCADE,
  attachment_type text NOT NULL CHECK (attachment_type IN ('invoice', 'photo', 'document')),
  storage_path    text NOT NULL,
  file_name       text NOT NULL,
  uploaded_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_conversion_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  unit_from           text NOT NULL,
  unit_to             text NOT NULL,
  conversion_rate     numeric(10,4) NOT NULL,
  wastage_pct         numeric(5,2) NOT NULL DEFAULT 0,
  notes               text,
  order_index         int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  default_unit_price  numeric(10,2)
);
ALTER TABLE material_conversion_settings ADD COLUMN IF NOT EXISTS default_unit_price numeric(10,2);

CREATE TABLE IF NOT EXISTS material_conversion_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_setting_id uuid NOT NULL REFERENCES material_conversion_settings(id) ON DELETE CASCADE,
  name              text NOT NULL,
  rate              numeric NOT NULL,
  unit              text NOT NULL,
  stock_field       text,
  order_index       int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE material_orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_order_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_conversion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_conversion_links    ENABLE ROW LEVEL SECURITY;

-- material_orders: all staff read, leading_hand+ insert/update, admin delete
DROP POLICY IF EXISTS "material_orders: all staff read" ON material_orders;
CREATE POLICY "material_orders: all staff read"
  ON material_orders FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_orders: leading_hand+ insert" ON material_orders;
CREATE POLICY "material_orders: leading_hand+ insert"
  ON material_orders FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_orders: leading_hand+ update" ON material_orders;
CREATE POLICY "material_orders: leading_hand+ update"
  ON material_orders FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_orders: admin delete" ON material_orders;
CREATE POLICY "material_orders: admin delete"
  ON material_orders FOR DELETE
  USING (current_user_role() = 'admin');

-- material_order_items: all staff read, leading_hand+ insert/update/delete
DROP POLICY IF EXISTS "material_order_items: all staff read" ON material_order_items;
CREATE POLICY "material_order_items: all staff read"
  ON material_order_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_items: leading_hand+ insert" ON material_order_items;
CREATE POLICY "material_order_items: leading_hand+ insert"
  ON material_order_items FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_items: leading_hand+ update" ON material_order_items;
CREATE POLICY "material_order_items: leading_hand+ update"
  ON material_order_items FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_items: leading_hand+ delete" ON material_order_items;
CREATE POLICY "material_order_items: leading_hand+ delete"
  ON material_order_items FOR DELETE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- material_order_attachments: all staff read, leading_hand+ insert/delete
DROP POLICY IF EXISTS "material_order_attachments: all staff read" ON material_order_attachments;
CREATE POLICY "material_order_attachments: all staff read"
  ON material_order_attachments FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_attachments: leading_hand+ insert" ON material_order_attachments;
CREATE POLICY "material_order_attachments: leading_hand+ insert"
  ON material_order_attachments FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_order_attachments: leading_hand+ delete" ON material_order_attachments;
CREATE POLICY "material_order_attachments: leading_hand+ delete"
  ON material_order_attachments FOR DELETE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

-- material_conversion_settings / links: all staff read, admin write
DROP POLICY IF EXISTS "material_conversion_settings: all staff read" ON material_conversion_settings;
CREATE POLICY "material_conversion_settings: all staff read"
  ON material_conversion_settings FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_conversion_settings: admin write" ON material_conversion_settings;
CREATE POLICY "material_conversion_settings: admin write"
  ON material_conversion_settings FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS "material_conversion_links: all staff read" ON material_conversion_links;
CREATE POLICY "material_conversion_links: all staff read"
  ON material_conversion_links FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_conversion_links: admin write" ON material_conversion_links;
CREATE POLICY "material_conversion_links: admin write"
  ON material_conversion_links FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- ── Materials: flexible stock (from migration_flexible_stock_system.sql) ──────
-- Replaces the fixed-column site_stock table (created by
-- migration_materials_orders.sql, dropped by this migration — so it is not
-- defined here).
CREATE TABLE IF NOT EXISTS material_types (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  unit                   text NOT NULL,
  stock_group            text NOT NULL CHECK (stock_group IN ('Plants', 'Mulch', 'Hardscape', 'Retic')),
  quant_item_names       text[] NOT NULL DEFAULT '{}',
  conversion_setting_id  uuid REFERENCES material_conversion_settings(id) ON DELETE SET NULL,
  is_active              boolean NOT NULL DEFAULT true,
  order_index            int NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE material_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_types: all staff read" ON material_types;
CREATE POLICY "material_types: all staff read"
  ON material_types FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "material_types: admin write" ON material_types;
CREATE POLICY "material_types: admin write"
  ON material_types FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

CREATE TABLE IF NOT EXISTS site_stock_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  material_type_id    uuid NOT NULL REFERENCES material_types(id) ON DELETE CASCADE,
  quantity            numeric(10,3) NOT NULL DEFAULT 0,
  last_updated_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_update_source  text, -- 'manual' | 'order_delivery' | 'quant_deduction'
  last_update_lot     text, -- lot number, only set when last_update_source = 'quant_deduction'
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, material_type_id)
);

DROP TRIGGER IF EXISTS site_stock_items_updated_at ON site_stock_items;
CREATE TRIGGER site_stock_items_updated_at
  BEFORE UPDATE ON site_stock_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE site_stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_stock_items: all staff read" ON site_stock_items;
CREATE POLICY "site_stock_items: all staff read"
  ON site_stock_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "site_stock_items: leading_hand+ insert" ON site_stock_items;
CREATE POLICY "site_stock_items: leading_hand+ insert"
  ON site_stock_items FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "site_stock_items: leading_hand+ update" ON site_stock_items;
CREATE POLICY "site_stock_items: leading_hand+ update"
  ON site_stock_items FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));


-- ── Plant species dictionary (from migration_prices_delays_photos_species.sql) ─
-- Admin write; the Orders bulk-add flow writes via the admin client.
CREATE TABLE IF NOT EXISTS plant_species (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text UNIQUE NOT NULL,
  default_pot_size text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plant_species ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plant_species: all staff read" ON plant_species;
CREATE POLICY "plant_species: all staff read"
  ON plant_species FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "plant_species: admin write" ON plant_species;
CREATE POLICY "plant_species: admin write"
  ON plant_species FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- ── Email recipients (from migration_email_recipients.sql,
--    migration_email_recipients_type.sql, migration_quant_issues.sql) ────────
-- email_type: 'weekly' | 'monthly' | 'both', or NULL for an issues-only
-- recipient. wants_issues is the independent issues-email flag.
CREATE TABLE IF NOT EXISTS email_recipients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES profiles(id),
  email_type   text CHECK (email_type IN ('weekly', 'monthly', 'both')),
  wants_issues boolean NOT NULL DEFAULT false
);
ALTER TABLE email_recipients ADD COLUMN IF NOT EXISTS email_type text CHECK (email_type IN ('weekly', 'monthly', 'both'));
ALTER TABLE email_recipients ALTER COLUMN email_type DROP NOT NULL;
ALTER TABLE email_recipients ALTER COLUMN email_type DROP DEFAULT;
ALTER TABLE email_recipients ADD COLUMN IF NOT EXISTS wants_issues boolean NOT NULL DEFAULT false;

ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_recipients: admin full access" ON email_recipients;
CREATE POLICY "email_recipients: admin full access"
  ON email_recipients FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- ── Invoice run PDF snapshots (from migration_invoice_snapshots.sql) ──────────
-- NOTE: invoice_runs itself is not defined in this file (created directly in
-- the Supabase dashboard). snapshot_paths = { lot_id: r2_path }.
ALTER TABLE invoice_runs ADD COLUMN IF NOT EXISTS snapshot_paths jsonb DEFAULT '{}';
ALTER TABLE invoice_runs ADD COLUMN IF NOT EXISTS invoiced_at    timestamptz DEFAULT now();


-- ── Site files + files_index view (from migration_site_files.sql) ─────────────
CREATE TABLE IF NOT EXISTS site_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES sites(id)  ON DELETE CASCADE,
  stage_id     uuid          REFERENCES stages(id) ON DELETE CASCADE,
  lot_id       uuid          REFERENCES lots(id)   ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name    text NOT NULL,
  file_type    text NOT NULL CHECK (file_type IN ('photo', 'pdf')),
  notes        text,
  uploaded_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- A lot can only be linked alongside its stage
  CONSTRAINT site_files_lot_needs_stage CHECK (lot_id IS NULL OR stage_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS site_files_site_created_idx ON site_files(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS site_files_stage_id_idx     ON site_files(stage_id);
CREATE INDEX IF NOT EXISTS site_files_lot_id_idx       ON site_files(lot_id);

ALTER TABLE site_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_files: staff read all"           ON site_files;
DROP POLICY IF EXISTS "site_files: staff insert own"         ON site_files;
DROP POLICY IF EXISTS "site_files: uploader or admin delete" ON site_files;

CREATE POLICY "site_files: staff read all"
  ON site_files FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

CREATE POLICY "site_files: staff insert own"
  ON site_files FOR INSERT
  WITH CHECK (
    current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin')
    AND uploaded_by = auth.uid()
  );

-- No UPDATE policy — files are immutable once uploaded.
CREATE POLICY "site_files: uploader or admin delete"
  ON site_files FOR DELETE
  USING (
    current_user_role() = 'admin'
    OR (
      current_user_role() IN ('worker', 'leading_hand', 'supervisor')
      AND uploaded_by = auth.uid()
    )
  );

-- Union of every non-pricing file source. security_invoker = true so the
-- caller's RLS on each underlying table still applies. Housing claims,
-- invoice snapshots, quote PDFs and material order attachments are
-- deliberately excluded (pricing).
DROP VIEW IF EXISTS files_index;
CREATE VIEW files_index WITH (security_invoker = true) AS
  SELECT
    lp.id, 'lot_photo'::text AS source, 'photo'::text AS kind,
    st.site_id, l.stage_id, lp.lot_id, NULL::uuid AS extra_job_id,
    lp.storage_path, NULL::text AS file_name, lp.notes,
    lp.uploaded_by, lp.created_at
  FROM lot_photos lp
  JOIN lots   l  ON l.id  = lp.lot_id
  JOIN stages st ON st.id = l.stage_id

  UNION ALL
  SELECT
    ejp.id, 'extra_job_photo', 'photo',
    st.site_id, ej.stage_id, NULL::uuid, ejp.extra_job_id,
    ejp.storage_path, NULL::text, ejp.notes,
    ejp.uploaded_by, ejp.created_at
  FROM extra_job_photos ejp
  JOIN extra_jobs ej ON ej.id = ejp.extra_job_id
  JOIN stages     st ON st.id = ej.stage_id

  UNION ALL
  SELECT
    ld.id, 'lot_document', 'document',
    st.site_id, l.stage_id, ld.lot_id, NULL::uuid,
    ld.storage_path, ld.document_name, NULL::text,
    ld.uploaded_by, ld.created_at
  FROM lot_documents ld
  JOIN lots   l  ON l.id  = ld.lot_id
  JOIN stages st ON st.id = l.stage_id
  WHERE ld.document_type::text <> 'housing_claim'   -- claims can carry pricing

  UNION ALL
  SELECT
    spd.id, 'site_plan', 'document',
    spd.site_id, NULL::uuid, NULL::uuid, NULL::uuid,
    spd.storage_path, COALESCE(spd.label, 'Site plan'), NULL::text,
    spd.uploaded_by, spd.created_at
  FROM site_plan_documents spd

  UNION ALL
  SELECT
    sf.id, 'site_file', CASE WHEN sf.file_type = 'pdf' THEN 'document' ELSE 'photo' END,
    sf.site_id, sf.stage_id, sf.lot_id, NULL::uuid,
    sf.storage_path, sf.file_name, sf.notes,
    sf.uploaded_by, sf.created_at
  FROM site_files sf;

REVOKE ALL    ON files_index FROM anon;
GRANT  SELECT ON files_index TO authenticated;


-- ── Profile FKs → ON DELETE SET NULL (from migration_profile_fk_set_null.sql,
--    migration_profile_fk_set_null_part2.sql) ──────────────────────────────
-- Deleting a user nulls author/uploader columns instead of being blocked by
-- them. Tables defined in section 3c above already declare this inline.
ALTER TABLE extra_job_photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE extra_job_photos DROP CONSTRAINT IF EXISTS extra_job_photos_uploaded_by_fkey;
ALTER TABLE extra_job_photos ADD CONSTRAINT extra_job_photos_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE lot_photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE lot_photos DROP CONSTRAINT IF EXISTS lot_photos_uploaded_by_fkey;
ALTER TABLE lot_photos ADD CONSTRAINT lot_photos_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE lot_documents ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE lot_documents DROP CONSTRAINT IF EXISTS lot_documents_uploaded_by_fkey;
ALTER TABLE lot_documents ADD CONSTRAINT lot_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE invitations ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey;
ALTER TABLE invitations ADD CONSTRAINT invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE site_plan_documents ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE site_plan_documents DROP CONSTRAINT IF EXISTS site_plan_documents_uploaded_by_fkey;
ALTER TABLE site_plan_documents ADD CONSTRAINT site_plan_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE toolbox_meetings ALTER COLUMN submitted_by DROP NOT NULL;
ALTER TABLE toolbox_meetings DROP CONSTRAINT IF EXISTS toolbox_meetings_submitted_by_fkey;
ALTER TABLE toolbox_meetings ADD CONSTRAINT toolbox_meetings_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE lot_quotes DROP CONSTRAINT IF EXISTS lot_quotes_quoted_by_fkey;
ALTER TABLE lot_quotes ADD CONSTRAINT lot_quotes_quoted_by_fkey
  FOREIGN KEY (quoted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE plant_ratio_settings DROP CONSTRAINT IF EXISTS plant_ratio_settings_updated_by_fkey;
ALTER TABLE plant_ratio_settings ADD CONSTRAINT plant_ratio_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE lot_trade_status DROP CONSTRAINT IF EXISTS lot_trade_status_updated_by_fkey;
ALTER TABLE lot_trade_status ADD CONSTRAINT lot_trade_status_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- NOTE: pre_starts, safety_form_completions, safety_documents and
-- document_signoffs are not defined in this file (created directly in the
-- Supabase dashboard); their FK changes are recorded here for accuracy.
ALTER TABLE pre_starts ALTER COLUMN submitted_by DROP NOT NULL;
ALTER TABLE pre_starts DROP CONSTRAINT IF EXISTS pre_starts_submitted_by_fkey;
ALTER TABLE pre_starts ADD CONSTRAINT pre_starts_submitted_by_fkey
  FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE safety_form_completions DROP CONSTRAINT IF EXISTS safety_form_completions_profile_id_fkey;
ALTER TABLE safety_form_completions ADD CONSTRAINT safety_form_completions_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE safety_documents ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE safety_documents DROP CONSTRAINT IF EXISTS safety_documents_uploaded_by_fkey;
ALTER TABLE safety_documents ADD CONSTRAINT safety_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE document_signoffs ALTER COLUMN signed_by DROP NOT NULL;
ALTER TABLE document_signoffs DROP CONSTRAINT IF EXISTS document_signoffs_signed_by_fkey;
ALTER TABLE document_signoffs ADD CONSTRAINT document_signoffs_signed_by_fkey
  FOREIGN KEY (signed_by) REFERENCES profiles(id) ON DELETE SET NULL;


-- =============================================================================
-- 3d. RLS hardening (from migration_rls_invites_profiles.sql,
--     migration_rls_lots_extrajobs.sql)
-- =============================================================================

-- ── Shared helper: which columns changed outside an allowed list ────────────
-- Returns NULL when nothing outside `allowed` changed. Compares whole rows as
-- jsonb so columns added later are protected automatically.
CREATE OR REPLACE FUNCTION changed_columns(old_row jsonb, new_row jsonb, allowed text[])
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT array_agg(n.key ORDER BY n.key)
  FROM jsonb_each(new_row) n
  WHERE NOT (n.key = ANY (allowed))
    AND n.value IS DISTINCT FROM (old_row -> n.key);
$$;


-- ── 1. invitations: token lookup function replaces "read by token" ─────────

DROP POLICY IF EXISTS "invitations: read by token (unauthenticated)" ON invitations;

-- One pending (not yet accepted) invite for the given token, with only the
-- fields the invite page shows. Expiry is still checked by the page and by
-- acceptInvite. The token is compared as text so a malformed token returns
-- no rows instead of a uuid cast error.
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token text)
RETURNS TABLE (
  email      text,
  role       text,
  profile_id uuid,
  sent_at    timestamptz,
  created_at timestamptz,
  first_name text,
  last_name  text
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.email::text,
    i.role::text,
    i.profile_id,
    i.sent_at::timestamptz,
    i.created_at,
    p.first_name::text,
    p.last_name::text
  FROM invitations i
  LEFT JOIN profiles p ON p.id = i.profile_id
  WHERE i.token::text = p_token
    AND i.accepted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL     ON FUNCTION get_invitation_by_token(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_invitation_by_token(text) TO anon, authenticated;


-- ── 2. invitations: supervisors can no longer create invites ────────────────

DROP POLICY IF EXISTS "invitations: supervisors create" ON invitations;


-- ── 3. profiles: non-admins can only change their name and phone ───────────

CREATE OR REPLACE FUNCTION profiles_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  bad text[];
BEGIN
  -- Service-role client / SQL editor (no signed-in user), or an admin
  IF auth.uid() IS NULL OR current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  bad := changed_columns(to_jsonb(OLD), to_jsonb(NEW), ARRAY['first_name', 'last_name', 'phone_number']);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Not allowed to change profile field(s): %', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_columns ON profiles;
CREATE TRIGGER profiles_guard_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_guard_columns();


-- ── 4. invoice_runs: one current_user_role() policy ─────────────────────────

DROP POLICY IF EXISTS "Admins can manage invoice runs" ON invoice_runs;
DROP POLICY IF EXISTS "invoice_runs: admin delete"     ON invoice_runs;
DROP POLICY IF EXISTS "invoice_runs: admin full access" ON invoice_runs;

CREATE POLICY "invoice_runs: admin full access"
  ON invoice_runs FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- ── 5. quotes: drop the EXISTS(profiles …) duplicate ────────────────────────
-- "quotes: supervisor+ full access" (current_user_role(), same roles) stays.

DROP POLICY IF EXISTS "Supervisors and admins can manage quotes" ON quotes;


-- ── 1. lots policies ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "lots: workers update own status"     ON lots;
DROP POLICY IF EXISTS "lots: leading_hands write"           ON lots;
DROP POLICY IF EXISTS "lots: supervisors and admins write"  ON lots;
DROP POLICY IF EXISTS "lots: leading_hand+ insert"          ON lots;
DROP POLICY IF EXISTS "lots: leading_hand+ update"          ON lots;
DROP POLICY IF EXISTS "lots: admin delete"                  ON lots;

-- Read policies ("workers and leading_hands read all", "supervisors and
-- admins read all", "clients read permitted lots") and "workers update
-- status" are unchanged.

CREATE POLICY "lots: leading_hand+ insert"
  ON lots FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

CREATE POLICY "lots: leading_hand+ update"
  ON lots FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

CREATE POLICY "lots: admin delete"
  ON lots FOR DELETE
  USING (current_user_role() = 'admin');


-- ── 2. lots column guard ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION lots_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r          role;
  admin_cols text[] := ARRAY['contract_price', 'invoiced', 'approved_for_invoicing',
                             'approved_for_invoicing_at', 'has_client_extras'];
  bad        text[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;   -- service role / SQL editor
  r := current_user_role();
  IF r = 'admin' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.contract_price IS NOT NULL
       OR NEW.invoiced
       OR NEW.approved_for_invoicing
       OR NEW.approved_for_invoicing_at IS NOT NULL
       OR NEW.pending_review
       OR NOT NEW.has_client_extras THEN
      RAISE EXCEPTION 'Only admins can set pricing or invoicing fields on a new lot'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF r = 'worker' THEN
    bad := changed_columns(to_jsonb(OLD), to_jsonb(NEW),
             ARRAY['status', 'notes', 'completion_date', 'updated_by', 'updated_at']);
  ELSE
    bad := ARRAY(
      SELECT c FROM unnest(admin_cols) c
      WHERE (to_jsonb(NEW) -> c) IS DISTINCT FROM (to_jsonb(OLD) -> c)
    );
    -- Leading hand+ may flag a lot for review, but not clear the flag
    IF NEW.pending_review IS DISTINCT FROM OLD.pending_review AND NOT NEW.pending_review THEN
      bad := bad || 'pending_review';
    END IF;
    IF cardinality(bad) = 0 THEN bad := NULL; END IF;
  END IF;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Not allowed to change lot field(s): %', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lots_guard_columns ON lots;
CREATE TRIGGER lots_guard_columns
  BEFORE INSERT OR UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION lots_guard_columns();


-- ── 3. extra_jobs policies + column guard ───────────────────────────────────

DROP POLICY IF EXISTS "extra_jobs: leading_hands and above write" ON extra_jobs;
DROP POLICY IF EXISTS "extra_jobs: leading_hand+ insert"          ON extra_jobs;
DROP POLICY IF EXISTS "extra_jobs: leading_hand+ update"          ON extra_jobs;
DROP POLICY IF EXISTS "extra_jobs: admin delete"                  ON extra_jobs;

-- Read policies ("staff read all", "clients read permitted") are unchanged.

CREATE POLICY "extra_jobs: leading_hand+ insert"
  ON extra_jobs FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

CREATE POLICY "extra_jobs: leading_hand+ update"
  ON extra_jobs FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

CREATE POLICY "extra_jobs: admin delete"
  ON extra_jobs FOR DELETE
  USING (current_user_role() = 'admin');

CREATE OR REPLACE FUNCTION extra_jobs_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  admin_cols text[] := ARRAY['invoiced', 'approved_for_invoicing', 'approved_for_invoicing_at',
                             'pending_review', 'finance_notes', 'approved_by_name'];
  bad        text[];
BEGIN
  IF auth.uid() IS NULL OR current_user_role() = 'admin' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.invoiced
       OR NEW.approved_for_invoicing
       OR NEW.approved_for_invoicing_at IS NOT NULL
       OR NEW.pending_review
       OR NEW.finance_notes IS NOT NULL
       OR NEW.approved_by_name IS NOT NULL THEN
      RAISE EXCEPTION 'Only admins can set invoicing fields on a new extra job'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  bad := ARRAY(
    SELECT c FROM unnest(admin_cols) c
    WHERE (to_jsonb(NEW) -> c) IS DISTINCT FROM (to_jsonb(OLD) -> c)
  );
  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION 'Not allowed to change extra job field(s): %', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS extra_jobs_guard_columns ON extra_jobs;
CREATE TRIGGER extra_jobs_guard_columns
  BEFORE INSERT OR UPDATE ON extra_jobs
  FOR EACH ROW EXECUTE FUNCTION extra_jobs_guard_columns();


-- ── 4. stages: contract pricing admin only ───────────────────────────────────

CREATE OR REPLACE FUNCTION stages_guard_pricing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user_role() = 'admin' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_contract_pricing OR NEW.default_contract_price IS NOT NULL THEN
      RAISE EXCEPTION 'Only admins can set contract pricing on a stage'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.is_contract_pricing IS DISTINCT FROM OLD.is_contract_pricing
     OR NEW.default_contract_price IS DISTINCT FROM OLD.default_contract_price THEN
    RAISE EXCEPTION 'Only admins can change contract pricing on a stage'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stages_guard_pricing ON stages;
CREATE TRIGGER stages_guard_pricing
  BEFORE INSERT OR UPDATE ON stages
  FOR EACH ROW EXECUTE FUNCTION stages_guard_pricing();


-- ── lots: refuse pending_review on approved lots (migration_lots_pending_review_guard.sql) ────

-- Refuse pending_review = true on a lot that is approved for invoicing.
--
-- The app already flags lots for review with a single UPDATE ... WHERE
-- approved_for_invoicing = false, but this also stops any other writer (an
-- old browser tab still running a previous deployment, the SQL editor, a
-- future code path) from leaving both Pending review and Approved ticked.
--
-- Only the change to true is refused. Rows already stuck with both flags on
-- can still be updated (and cleared) normally, and approving a lot that is
-- pending review is unaffected.

CREATE OR REPLACE FUNCTION lots_guard_pending_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pending_review
     AND NEW.approved_for_invoicing
     AND (TG_OP = 'INSERT' OR NOT OLD.pending_review) THEN
    RAISE EXCEPTION 'Lot is approved for invoicing. Un-approve it before flagging it for review.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lots_guard_pending_review ON lots;
CREATE TRIGGER lots_guard_pending_review
  BEFORE INSERT OR UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION lots_guard_pending_review();


-- ── extra job lines: transactional in-place save (migration_extra_job_lines_save.sql) ────

-- Extra job line items: save in one transaction, update in place, and refuse
-- a save when someone else saved the lines since the page was loaded.
--
-- Replaces the old delete-everything-then-reinsert save, which:
--   - gave every line a new id, so a second save by a non-admin couldn't find
--     the admin-set prices and wiped them
--   - dropped the template link (and with it the price) on old quant-sheet rows
--   - lost every line if the insert failed after the delete
--
-- lines_updated_at is bumped only by this function; the page sends back the
-- value it loaded, and a mismatch means another save happened in between.
--
-- p_lines is a JSON array, in display order, of:
--   { "id": uuid | null, "description": text | null, "unit": text,
--     "quantity": number | null, "unit_price": number | null,
--     "keep_price": boolean }
-- keep_price = true leaves an existing line's unit_price as it is (non-admin
-- saves); a new line saved with keep_price gets no price.
-- Existing lines missing from p_lines are deleted (removed in the UI).
--
-- SECURITY INVOKER (the default), so RLS still applies: only leading hand and
-- above can save.

ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS lines_updated_at timestamptz;

CREATE OR REPLACE FUNCTION save_extra_job_lines(
  p_extra_job_id              uuid,
  p_expected_lines_updated_at timestamptz,
  p_lines                     jsonb
)
RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current timestamptz;
  v_now     timestamptz := clock_timestamp();
  v_line    jsonb;
  v_index   integer := 0;
  v_id      uuid;
  v_rows    integer;
  v_kept    uuid[] := '{}';
BEGIN
  -- Row lock: a second save waits here, then fails the version check below.
  SELECT lines_updated_at INTO v_current
  FROM extra_jobs
  WHERE id = p_extra_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extra job not found, or you do not have permission to edit it.'
      USING ERRCODE = '42501';
  END IF;

  IF v_current IS DISTINCT FROM p_expected_lines_updated_at THEN
    RAISE EXCEPTION 'Someone else updated this job, reload'
      USING ERRCODE = '40001';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_id   := NULLIF(v_line->>'id', '')::uuid;
    v_rows := 0;

    IF v_id IS NOT NULL THEN
      UPDATE extra_job_quote_items SET
        description = v_line->>'description',
        unit        = COALESCE(NULLIF(v_line->>'unit', ''), 'No.'),
        quantity    = (v_line->>'quantity')::numeric,
        unit_price  = CASE WHEN COALESCE((v_line->>'keep_price')::boolean, false)
                           THEN unit_price
                           ELSE (v_line->>'unit_price')::numeric END,
        item_type   = 'line',
        sort_order  = v_index
      WHERE id = v_id AND extra_job_id = p_extra_job_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
    END IF;

    IF v_rows = 0 THEN
      INSERT INTO extra_job_quote_items
        (extra_job_id, description, unit, quantity, unit_price, item_type, sort_order)
      VALUES (
        p_extra_job_id,
        v_line->>'description',
        COALESCE(NULLIF(v_line->>'unit', ''), 'No.'),
        (v_line->>'quantity')::numeric,
        CASE WHEN COALESCE((v_line->>'keep_price')::boolean, false)
             THEN NULL
             ELSE (v_line->>'unit_price')::numeric END,
        'line',
        v_index
      )
      RETURNING id INTO v_id;
    END IF;

    v_kept  := v_kept || v_id;
    v_index := v_index + 1;
  END LOOP;

  DELETE FROM extra_job_quote_items
  WHERE extra_job_id = p_extra_job_id
    AND NOT (id = ANY (v_kept));

  UPDATE extra_jobs SET lines_updated_at = v_now WHERE id = p_extra_job_id;

  RETURN v_now;
END;
$$;

REVOKE EXECUTE ON FUNCTION save_extra_job_lines(uuid, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION save_extra_job_lines(uuid, timestamptz, jsonb) TO authenticated;


-- ── extra jobs: sections, last edited by, pending review guard (migration_extra_job_sections.sql) ────

-- Extra jobs: named sections, "last edited by", and a pending-review guard.
--
-- 1. extra_job_sections: named sections (blank name = no heading) that line
--    items belong to, in order.
-- 2. extra_job_quote_items.section_id. ON DELETE SET NULL, so deleting a
--    section can never delete lines with it.
-- 3. Backfill: every job that has lines gets one unnamed section holding all
--    of them. Unnamed sections show no heading, so existing jobs look the
--    same. No quantity or price is touched, so no total changes.
-- 4. extra_jobs.updated_by, set by trigger to the logged-in user on every
--    change to the job (NULL for system / SQL editor writes).
-- 5. Refuse pending_review = true on an extra job that is approved for
--    invoicing (same rule as lots_guard_pending_review).
-- 6. save_extra_job_lines, replaced in place (same name and parameters):
--    p_lines is now { "sections": [ { "id", "name", "lines": [...] } ] },
--    still accepting the old flat array from a tab open before this change.
--
-- Safe to run more than once.

-- ── 1. Sections ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS extra_job_sections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_job_id uuid NOT NULL REFERENCES extra_jobs(id) ON DELETE CASCADE,
  name         text NOT NULL DEFAULT '',
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS extra_job_sections_extra_job_id_idx ON extra_job_sections(extra_job_id);
ALTER TABLE extra_job_sections ENABLE ROW LEVEL SECURITY;

-- Same access as extra_job_quote_items
DROP POLICY IF EXISTS "ejs: leading_hand+ access" ON extra_job_sections;
DROP POLICY IF EXISTS "ejs: workers read"          ON extra_job_sections;
CREATE POLICY "ejs: leading_hand+ access"
  ON extra_job_sections FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));
CREATE POLICY "ejs: workers read"
  ON extra_job_sections FOR SELECT
  USING (current_user_role() = 'worker');

-- ── 2. Lines belong to a section ────────────────────────────────────────────

ALTER TABLE extra_job_quote_items
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES extra_job_sections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS extra_job_quote_items_section_id_idx ON extra_job_quote_items(section_id);

-- ── 3. Backfill ─────────────────────────────────────────────────────────────

INSERT INTO extra_job_sections (extra_job_id, name, sort_order)
SELECT DISTINCT i.extra_job_id, '', 0
FROM extra_job_quote_items i
WHERE i.section_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM extra_job_sections s WHERE s.extra_job_id = i.extra_job_id);

UPDATE extra_job_quote_items i
SET section_id = (
  SELECT s.id FROM extra_job_sections s
  WHERE s.extra_job_id = i.extra_job_id
  ORDER BY s.sort_order, s.created_at
  LIMIT 1
)
WHERE i.section_id IS NULL;

-- ── 4. Last edited by ───────────────────────────────────────────────────────

ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION extra_jobs_set_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- NULL for service-role / SQL editor writes, so the page never shows the
  -- previous editor's name against a change they didn't make.
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS extra_jobs_set_updated_by ON extra_jobs;
CREATE TRIGGER extra_jobs_set_updated_by
  BEFORE INSERT OR UPDATE ON extra_jobs
  FOR EACH ROW EXECUTE FUNCTION extra_jobs_set_updated_by();

-- ── 5. Pending review guard ─────────────────────────────────────────────────
-- Only the change to true is refused. Rows already stuck with both flags on
-- can still be updated (and cleared), and approving a job that is pending
-- review is unaffected.

CREATE OR REPLACE FUNCTION extra_jobs_guard_pending_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pending_review
     AND NEW.approved_for_invoicing
     AND (TG_OP = 'INSERT' OR NOT OLD.pending_review) THEN
    RAISE EXCEPTION 'Extra job is approved for invoicing. Un-approve it before flagging it for review.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS extra_jobs_guard_pending_review ON extra_jobs;
CREATE TRIGGER extra_jobs_guard_pending_review
  BEFORE INSERT OR UPDATE ON extra_jobs
  FOR EACH ROW EXECUTE FUNCTION extra_jobs_guard_pending_review();

-- ── 6. save_extra_job_lines with sections ───────────────────────────────────
-- p_lines, new shape:
--   { "sections": [ { "id": uuid | null, "name": text,
--                     "lines": [ { "id", "description", "unit", "quantity",
--                                  "unit_price", "keep_price" } ] } ] }
-- Sections and their lines are saved in the order given. A line moved to
-- another section is updated in place (same id, same price). Lines and
-- sections missing from the payload are deleted — lines first.
--
-- p_lines, old flat array (a tab open from before sections): existing lines
-- keep their section, new lines go into the job's first section, and no
-- sections are deleted.
--
-- Unchanged: row lock + version check, keep_price, lines_updated_at bump.

CREATE OR REPLACE FUNCTION save_extra_job_lines(
  p_extra_job_id              uuid,
  p_expected_lines_updated_at timestamptz,
  p_lines                     jsonb
)
RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current       timestamptz;
  v_now           timestamptz := clock_timestamp();
  v_legacy        boolean := jsonb_typeof(p_lines) = 'array';
  v_sections      jsonb;
  v_section       jsonb;
  v_section_id    uuid;
  v_section_index integer := 0;
  v_line          jsonb;
  v_index         integer;
  v_id            uuid;
  v_rows          integer;
  v_kept          uuid[] := '{}';
  v_kept_sections uuid[] := '{}';
BEGIN
  -- Row lock: a second save waits here, then fails the version check below.
  SELECT lines_updated_at INTO v_current
  FROM extra_jobs
  WHERE id = p_extra_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Extra job not found, or you do not have permission to edit it.'
      USING ERRCODE = '42501';
  END IF;

  IF v_current IS DISTINCT FROM p_expected_lines_updated_at THEN
    RAISE EXCEPTION 'Someone else updated this job, reload'
      USING ERRCODE = '40001';
  END IF;

  IF v_legacy THEN
    v_sections := jsonb_build_array(jsonb_build_object('lines', p_lines));
  ELSIF jsonb_typeof(p_lines->'sections') = 'array' THEN
    v_sections := p_lines->'sections';
  ELSE
    RAISE EXCEPTION 'Invalid line items payload.' USING ERRCODE = '22023';
  END IF;

  FOR v_section IN SELECT value FROM jsonb_array_elements(v_sections) LOOP
    IF v_legacy THEN
      -- New lines from an old tab go into the first section (created if the
      -- job has none yet).
      SELECT id INTO v_section_id
      FROM extra_job_sections
      WHERE extra_job_id = p_extra_job_id
      ORDER BY sort_order, created_at
      LIMIT 1;
      IF v_section_id IS NULL THEN
        INSERT INTO extra_job_sections (extra_job_id, name, sort_order)
        VALUES (p_extra_job_id, '', 0)
        RETURNING id INTO v_section_id;
      END IF;
    ELSE
      v_section_id := NULLIF(v_section->>'id', '')::uuid;
      v_rows := 0;
      IF v_section_id IS NOT NULL THEN
        UPDATE extra_job_sections SET
          name       = COALESCE(v_section->>'name', ''),
          sort_order = v_section_index
        WHERE id = v_section_id AND extra_job_id = p_extra_job_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
      END IF;
      IF v_rows = 0 THEN
        INSERT INTO extra_job_sections (extra_job_id, name, sort_order)
        VALUES (p_extra_job_id, COALESCE(v_section->>'name', ''), v_section_index)
        RETURNING id INTO v_section_id;
      END IF;
      v_kept_sections := v_kept_sections || v_section_id;
    END IF;

    v_index := 0;
    FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(v_section->'lines', '[]'::jsonb)) LOOP
      v_id   := NULLIF(v_line->>'id', '')::uuid;
      v_rows := 0;

      IF v_id IS NOT NULL THEN
        UPDATE extra_job_quote_items SET
          description = v_line->>'description',
          unit        = COALESCE(NULLIF(v_line->>'unit', ''), 'No.'),
          quantity    = NULLIF(v_line->>'quantity', '')::numeric,
          unit_price  = CASE WHEN COALESCE((v_line->>'keep_price')::boolean, false)
                             THEN unit_price
                             ELSE NULLIF(v_line->>'unit_price', '')::numeric END,
          item_type   = 'line',
          section_id  = CASE WHEN v_legacy THEN COALESCE(section_id, v_section_id)
                             ELSE v_section_id END,
          sort_order  = v_index
        WHERE id = v_id AND extra_job_id = p_extra_job_id;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
      END IF;

      IF v_rows = 0 THEN
        INSERT INTO extra_job_quote_items
          (extra_job_id, section_id, description, unit, quantity, unit_price, item_type, sort_order)
        VALUES (
          p_extra_job_id,
          v_section_id,
          v_line->>'description',
          COALESCE(NULLIF(v_line->>'unit', ''), 'No.'),
          NULLIF(v_line->>'quantity', '')::numeric,
          CASE WHEN COALESCE((v_line->>'keep_price')::boolean, false)
               THEN NULL
               ELSE NULLIF(v_line->>'unit_price', '')::numeric END,
          'line',
          v_index
        )
        RETURNING id INTO v_id;
      END IF;

      v_kept  := v_kept || v_id;
      v_index := v_index + 1;
    END LOOP;

    v_section_index := v_section_index + 1;
  END LOOP;

  DELETE FROM extra_job_quote_items
  WHERE extra_job_id = p_extra_job_id
    AND NOT (id = ANY (v_kept));

  IF NOT v_legacy THEN
    DELETE FROM extra_job_sections
    WHERE extra_job_id = p_extra_job_id
      AND NOT (id = ANY (v_kept_sections));
  END IF;

  UPDATE extra_jobs SET lines_updated_at = v_now WHERE id = p_extra_job_id;

  RETURN v_now;
END;
$$;

REVOKE EXECUTE ON FUNCTION save_extra_job_lines(uuid, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION save_extra_job_lines(uuid, timestamptz, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
