-- READ-ONLY. Run query 1 before migration_extra_job_sections.sql and again
-- after it: every total must match. Queries 2 and 3 are for after only.

-- 1. Extra job totals, same formula as getExtraJobsPricing:
--    qty (empty = 0) × (line price, else template price); unpriced lines add 0.
SELECT ej.id, si.name AS site, st.name AS stage, ej.title, ej.invoiced,
       count(i.id) AS lines,
       round(coalesce(sum(coalesce(i.quantity, 0) * coalesce(i.unit_price, qti.unit_price)), 0), 2) AS total
FROM extra_jobs ej
JOIN stages st ON st.id = ej.stage_id
JOIN sites  si ON si.id = st.site_id
LEFT JOIN extra_job_quote_items i   ON i.extra_job_id = ej.id
LEFT JOIN quote_template_items  qti ON qti.id = i.template_item_id
GROUP BY ej.id, si.name, st.name, ej.title, ej.invoiced, ej.created_at
ORDER BY ej.created_at DESC
LIMIT 15;

-- 2. Lines not in a section. Must return 0.
SELECT count(*) AS lines_without_section
FROM extra_job_quote_items
WHERE section_id IS NULL;

-- 3. Jobs whose section subtotals don't add up to the job total, or whose
--    lines sit in another job's section. Must return no rows.
WITH line_totals AS (
  SELECT i.extra_job_id, i.section_id, s.extra_job_id AS section_job_id,
         coalesce(i.quantity, 0) * coalesce(i.unit_price, qti.unit_price) AS amount
  FROM extra_job_quote_items i
  LEFT JOIN extra_job_sections   s   ON s.id = i.section_id
  LEFT JOIN quote_template_items qti ON qti.id = i.template_item_id
),
by_section AS (
  SELECT extra_job_id, section_id, coalesce(sum(amount), 0) AS subtotal
  FROM line_totals GROUP BY extra_job_id, section_id
)
SELECT j.extra_job_id,
       (SELECT coalesce(sum(amount), 0) FROM line_totals t WHERE t.extra_job_id = j.extra_job_id) AS job_total,
       (SELECT sum(subtotal) FROM by_section b WHERE b.extra_job_id = j.extra_job_id)            AS sum_of_sections,
       (SELECT count(*) FROM line_totals t
        WHERE t.extra_job_id = j.extra_job_id AND t.section_job_id IS DISTINCT FROM t.extra_job_id) AS lines_in_wrong_job_section
FROM (SELECT DISTINCT extra_job_id FROM line_totals) j
WHERE (SELECT coalesce(sum(amount), 0) FROM line_totals t WHERE t.extra_job_id = j.extra_job_id)
   <> (SELECT sum(subtotal) FROM by_section b WHERE b.extra_job_id = j.extra_job_id)
   OR EXISTS (SELECT 1 FROM line_totals t
              WHERE t.extra_job_id = j.extra_job_id AND t.section_job_id IS DISTINCT FROM t.extra_job_id);
