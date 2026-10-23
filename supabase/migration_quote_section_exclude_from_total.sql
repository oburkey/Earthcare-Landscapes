-- =============================================================================
-- Earthcare Landscapes — Migration: optional quote sections (excluded from total)
--
-- Sections dragged below the "Total (ex GST)" divider in the quote builder
-- (and Settings → Quote Templates) are optional extras: still listed with
-- their own subtotal, but not counted in the quote's calculated total. On the
-- PDF they appear under "Optional items — not included in total".
--
-- Existing sections default to false (included), so current quotes and
-- templates are unchanged.
--
-- Safe to run multiple times.
-- =============================================================================

ALTER TABLE quote_sections
  ADD COLUMN IF NOT EXISTS exclude_from_total boolean NOT NULL DEFAULT false;

ALTER TABLE quote_preset_sections
  ADD COLUMN IF NOT EXISTS exclude_from_total boolean NOT NULL DEFAULT false;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
