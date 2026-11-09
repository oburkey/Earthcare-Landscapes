-- READ-ONLY. Extra job line items with no price: no unit_price of their own
-- and no template price to fall back on. These show as $0 on the job and in
-- claim PDFs. Lines whose price was wiped by the old save (a non-admin's
-- second save, or an old quant-sheet row losing its template link) show up
-- here, alongside lines a leading hand added that were never priced.
-- quote_converted = true means the job came from a quote; compare its lines
-- with the quote's rates.

SELECT
  si.name                                              AS site,
  st.name                                              AS stage,
  ej.title                                             AS job,
  ej.status                                            AS job_status,
  ej.invoiced                                          AS job_invoiced,
  ej.source_quote_id IS NOT NULL                       AS quote_converted,
  COALESCE(NULLIF(i.description, ''), qti.name, '')    AS line,
  i.quantity,
  i.unit,
  i.item_type,
  i.created_at AT TIME ZONE 'Australia/Perth'          AS line_saved_perth,
  ej.id                                                AS extra_job_id,
  i.id                                                 AS line_id
FROM extra_job_quote_items i
JOIN extra_jobs ej  ON ej.id = i.extra_job_id
JOIN stages st      ON st.id = ej.stage_id
JOIN sites si       ON si.id = st.site_id
LEFT JOIN quote_template_items qti ON qti.id = i.template_item_id
WHERE i.unit_price IS NULL
  AND qti.unit_price IS NULL
ORDER BY si.name, st.name, ej.title, i.sort_order;
