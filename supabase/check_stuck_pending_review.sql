-- Lots / extra jobs that are approved for invoicing but still flagged Pending review.
-- Run section 1 (read-only) first. Only run section 2 after checking the list.

-- ── 1. READ-ONLY: list the stuck rows ────────────────────────────────────────
-- final_quote_updated_at later than approved_for_invoicing_at (or approval time
-- unknown) suggests a Final quant sheet save re-flagged the lot after approval.
SELECT
  'lot'                         AS kind,
  l.id,
  si.name                       AS site,
  st.name                       AS stage,
  l.lot_number                  AS ref,
  l.approved_for_invoicing_at   AT TIME ZONE 'Australia/Perth' AS approved_at_perth,
  fq.updated_at                 AT TIME ZONE 'Australia/Perth' AS final_quote_updated_at_perth,
  l.updated_at                  AT TIME ZONE 'Australia/Perth' AS row_updated_at_perth
FROM lots l
JOIN stages st ON st.id = l.stage_id
JOIN sites  si ON si.id = st.site_id
LEFT JOIN lot_quotes fq ON fq.lot_id = l.id AND fq.is_estimated = false
WHERE l.approved_for_invoicing = true
  AND l.pending_review = true

UNION ALL

SELECT
  'extra_job',
  ej.id,
  si.name,
  st.name,
  ej.title,
  ej.approved_for_invoicing_at AT TIME ZONE 'Australia/Perth',
  NULL,
  ej.updated_at                AT TIME ZONE 'Australia/Perth'
FROM extra_jobs ej
JOIN stages st ON st.id = ej.stage_id
JOIN sites  si ON si.id = st.site_id
WHERE ej.approved_for_invoicing = true
  AND ej.pending_review = true
ORDER BY kind, site, stage, ref;


-- ── 2. UPDATE: clear pending_review on those rows ────────────────────────────
-- Run only after reviewing section 1. Touches pending_review only.
-- BEGIN;
-- UPDATE lots
--    SET pending_review = false
--  WHERE approved_for_invoicing = true
--    AND pending_review = true
-- RETURNING id, lot_number;
--
-- UPDATE extra_jobs
--    SET pending_review = false
--  WHERE approved_for_invoicing = true
--    AND pending_review = true
-- RETURNING id, title;
-- COMMIT;
