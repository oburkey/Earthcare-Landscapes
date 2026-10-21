-- =============================================================================
-- Earthcare Landscapes — Migration: Files page (site_files + files_index)
--
-- 1. site_files — new site-level uploads (photos + PDFs) from the Files page.
--    site_id required; stage_id / lot_id optional.
-- 2. files_index — read-only view that unions every non-pricing file source
--    so the Files page can filter, search and paginate across all of them:
--      lot_photos, extra_job_photos, lot_documents (excl. housing_claim),
--      site_plan_documents, site_files.
--    Deliberately NOT included (pricing): invoice snapshots, quote PDFs,
--    material order attachments.
--    security_invoker = true → the caller's RLS on every underlying table
--    still applies, so the view never shows anything a user couldn't
--    already read directly.
--
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS / DROP IF EXISTS / OR REPLACE.
-- =============================================================================

-- ── 1. site_files ────────────────────────────────────────────────────────────

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

DROP POLICY IF EXISTS "site_files: staff read all"            ON site_files;
DROP POLICY IF EXISTS "site_files: staff insert own"          ON site_files;
DROP POLICY IF EXISTS "site_files: uploader or admin delete"  ON site_files;

-- All internal roles can see every site file
CREATE POLICY "site_files: staff read all"
  ON site_files FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- All internal roles can upload, always as themselves
CREATE POLICY "site_files: staff insert own"
  ON site_files FOR INSERT
  WITH CHECK (
    current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin')
    AND uploaded_by = auth.uid()
  );

-- Uploader can delete their own; admin can delete any. No UPDATE policy —
-- files are immutable once uploaded.
CREATE POLICY "site_files: uploader or admin delete"
  ON site_files FOR DELETE
  USING (
    current_user_role() = 'admin'
    OR (
      current_user_role() IN ('worker', 'leading_hand', 'supervisor')
      AND uploaded_by = auth.uid()
    )
  );


-- ── 2. files_index view ──────────────────────────────────────────────────────

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

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
