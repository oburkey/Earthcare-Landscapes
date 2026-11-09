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
