-- =============================================================================
-- Earthcare Landscapes — Migration: quant sheet issue checks + issues email
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS / DROP IF EXISTS throughout.
-- =============================================================================

-- ── 1. Timestamp for "approved for invoicing more than 14 days" check ───────
-- Set/cleared by the existing toggleApprovedForInvoicing /
-- toggleExtraJobApprovedForInvoicing actions whenever the boolean flips.

ALTER TABLE lots       ADD COLUMN IF NOT EXISTS approved_for_invoicing_at timestamptz;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS approved_for_invoicing_at timestamptz;


-- ── 2. A third, independent recipient list for the weekly issues email ──────
-- email_recipients.email_type is a single-column sentinel ('weekly' |
-- 'monthly' | 'both') with one row per email (email is UNIQUE) — there's no
-- slot for a third overlapping list without the sentinel values growing
-- combinatorially. Instead, 'issues' gets its own independent boolean flag,
-- decoupled from email_type entirely. An issues-only recipient has
-- email_type = NULL (loosened from NOT NULL) and wants_issues = true; an
-- existing weekly/monthly/both row is untouched unless someone also opts
-- it into issues.

ALTER TABLE email_recipients ALTER COLUMN email_type DROP NOT NULL;
ALTER TABLE email_recipients ALTER COLUMN email_type DROP DEFAULT;
ALTER TABLE email_recipients ADD COLUMN IF NOT EXISTS wants_issues boolean NOT NULL DEFAULT false;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
