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
          quantity    = (v_line->>'quantity')::numeric,
          unit_price  = CASE WHEN COALESCE((v_line->>'keep_price')::boolean, false)
                             THEN unit_price
                             ELSE (v_line->>'unit_price')::numeric END,
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
