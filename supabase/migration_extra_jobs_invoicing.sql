-- Extra jobs get the same invoicing toggle flow as lots: pending_review,
-- approved_for_invoicing, and a real invoiced column (previously derived only
-- from invoice_runs.extra_job_ids membership — now kept in sync with it so a
-- direct manual toggle works the same way lots.invoiced does).

ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS pending_review boolean NOT NULL DEFAULT false;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS approved_for_invoicing boolean NOT NULL DEFAULT false;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS invoiced boolean NOT NULL DEFAULT false;

-- Backfill invoiced from existing invoice_runs history so past invoiced extra
-- jobs aren't shown as un-invoiced after this migration runs.
UPDATE extra_jobs
SET invoiced = true
WHERE id IN (
  SELECT unnest(extra_job_ids) FROM invoice_runs WHERE extra_job_ids IS NOT NULL
);
