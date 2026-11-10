-- Safety: company + site safety details, per-site SWMS, signed snapshots and
-- stored signed PDFs, safety review email flag, induction rename, reference
-- documents as uploaded PDFs.
--
-- Adds only — no table, column or row is deleted. The old upload-and-sign
-- tables (safety_documents, document_signoffs) are not touched.
--
-- safety_form_* and safety_reference_documents were created in the Supabase
-- dashboard; their existing columns and policies are left as they are.
--
-- Safe to run more than once.

-- ── 1. Company details (one row; admin edits, staff read) ───────────────────

CREATE TABLE IF NOT EXISTS company_safety_details (
  id                        boolean PRIMARY KEY DEFAULT true CHECK (id),
  company_name              text NOT NULL DEFAULT 'Earthcare Landscapes',
  abn                       text,
  address                   text,
  phone                     text,
  whs_contact_name          text,
  whs_contact_phone         text,
  safety_responsible_person text,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid REFERENCES profiles(id) ON DELETE SET NULL
);
INSERT INTO company_safety_details (id) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE company_safety_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "csd: staff read"   ON company_safety_details;
DROP POLICY IF EXISTS "csd: admin update" ON company_safety_details;
CREATE POLICY "csd: staff read" ON company_safety_details FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "csd: admin update" ON company_safety_details FOR UPDATE
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- ── 2. Site safety details (one row per site; supervisor+ edits) ────────────
-- last_reviewed_* is set by the app on every save and by "Mark reviewed, no
-- changes". 6+ months since last_reviewed_at (Perth date) = overdue.

CREATE TABLE IF NOT EXISTS site_safety_details (
  site_id                      uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  project_name                 text,
  project_address              text,
  principal_contractor         text,
  principal_contractor_contact text,
  principal_contractor_phone   text,
  site_supervisor              text,
  site_supervisor_phone        text,
  nearest_hospital             text,
  nearest_hospital_address     text,
  nearest_hospital_phone       text,
  assembly_point               text,
  first_aid_kit_location       text,
  fire_extinguisher_location   text,
  site_hours                   text,
  site_access                  text,
  site_hazards                 text,
  environmental_controls       text,
  required_ppe                 text,
  last_reviewed_at             timestamptz,
  last_reviewed_by             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by                   uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE site_safety_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ssd: staff read"         ON site_safety_details;
DROP POLICY IF EXISTS "ssd: supervisor+ insert" ON site_safety_details;
DROP POLICY IF EXISTS "ssd: supervisor+ update" ON site_safety_details;
CREATE POLICY "ssd: staff read" ON site_safety_details FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "ssd: supervisor+ insert" ON site_safety_details FOR INSERT
  WITH CHECK (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "ssd: supervisor+ update" ON site_safety_details FOR UPDATE
  USING (current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('supervisor', 'admin'));
-- No DELETE policy: site safety details are never deleted from the app.

-- ── 3. Per-site SWMS (one per site per template) ────────────────────────────
-- Created when a SWMS is first assigned for a site, copying the company and
-- site details into `details`. From then on it is its own copy, edited per
-- job; later site detail changes don't flow in unless "Refresh from site
-- details" is used. No ON DELETE on template_id: a template with site SWMS
-- can't be deleted out from under them.

CREATE TABLE IF NOT EXISTS site_swms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  template_id         uuid NOT NULL REFERENCES safety_form_templates(id),
  details             jsonb NOT NULL DEFAULT '{}'::jsonb,
  date_provided_to_pc date,
  reviewed_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by_name    text,  -- as printed; kept if the profile is removed
  reviewed_at         date,  -- Perth date
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (site_id, template_id)
);
CREATE INDEX IF NOT EXISTS site_swms_template_id_idx ON site_swms(template_id);

ALTER TABLE site_swms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "swms: staff read"         ON site_swms;
DROP POLICY IF EXISTS "swms: supervisor+ insert" ON site_swms;
DROP POLICY IF EXISTS "swms: supervisor+ update" ON site_swms;
CREATE POLICY "swms: staff read" ON site_swms FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));
CREATE POLICY "swms: supervisor+ insert" ON site_swms FOR INSERT
  WITH CHECK (current_user_role() IN ('supervisor', 'admin'));
CREATE POLICY "swms: supervisor+ update" ON site_swms FOR UPDATE
  USING (current_user_role() IN ('supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('supervisor', 'admin'));
-- No DELETE policy.

-- ── 4. Assignments point at the site's SWMS ─────────────────────────────────

ALTER TABLE safety_form_assignments
  ADD COLUMN IF NOT EXISTS site_swms_id uuid REFERENCES site_swms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS safety_form_assignments_site_swms_id_idx ON safety_form_assignments(site_swms_id);

-- ── 5. Completions: what was signed, and the PDF made at that moment ────────
-- All built on the server at submit time, never taken from the browser.
-- The completion row is saved first; the PDF is generated after it, so a PDF
-- failure never loses a submission (signed_pdf_error is set instead and
-- admins get "Regenerate PDF"). Download always serves signed_pdf_path.
-- There is deliberately no UPDATE policy on safety_form_completions: the PDF
-- columns are written by the server with the admin client.

ALTER TABLE safety_form_completions ADD COLUMN IF NOT EXISTS template_title_snapshot text;
ALTER TABLE safety_form_completions ADD COLUMN IF NOT EXISTS content_snapshot_html   text;   -- SWMS / JSA with placeholders filled
ALTER TABLE safety_form_completions ADD COLUMN IF NOT EXISTS sections_snapshot       jsonb;  -- checklist items as shown
ALTER TABLE safety_form_completions ADD COLUMN IF NOT EXISTS site_details_snapshot   jsonb;  -- site information block as shown
ALTER TABLE safety_form_completions ADD COLUMN IF NOT EXISTS signed_pdf_path         text;   -- R2 key of the stored PDF
ALTER TABLE safety_form_completions ADD COLUMN IF NOT EXISTS signed_pdf_generated_at timestamptz;
ALTER TABLE safety_form_completions ADD COLUMN IF NOT EXISTS signed_pdf_error        text;   -- last generation error, cleared on success

-- ── 6. Rename the induction (form number FHS001 unchanged) ──────────────────

UPDATE safety_form_templates
SET title = 'Health, Safety, Environment and Site Induction Checklist'
WHERE title = 'Health, Safety & Site Induction Checklist';

-- ── 7. Safety review email recipients ───────────────────────────────────────

ALTER TABLE email_recipients ADD COLUMN IF NOT EXISTS wants_safety boolean NOT NULL DEFAULT false;

-- ── 8. Reference documents become uploaded PDFs ─────────────────────────────
-- Existing srd_admin (admin write) / srd_select (staff read) policies apply.

ALTER TABLE safety_reference_documents ADD COLUMN IF NOT EXISTS file_path text;  -- R2 key
ALTER TABLE safety_reference_documents ADD COLUMN IF NOT EXISTS file_name text;  -- original file name
ALTER TABLE safety_reference_documents ALTER COLUMN content_html DROP NOT NULL;

ALTER TABLE safety_reference_documents DROP CONSTRAINT IF EXISTS safety_reference_documents_has_content;
ALTER TABLE safety_reference_documents ADD CONSTRAINT safety_reference_documents_has_content
  CHECK (file_path IS NOT NULL OR content_html IS NOT NULL);

NOTIFY pgrst, 'reload schema';
