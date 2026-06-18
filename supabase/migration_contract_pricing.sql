-- =============================================================================
-- Earthcare Landscapes — Migration: Contract Pricing at Stage Level
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS throughout.
-- =============================================================================


-- ── 1. Add contract pricing fields to stages ─────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stages' AND column_name = 'is_contract_pricing'
  ) THEN
    ALTER TABLE stages ADD COLUMN is_contract_pricing boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stages' AND column_name = 'default_contract_price'
  ) THEN
    ALTER TABLE stages ADD COLUMN default_contract_price numeric(10,2);
  END IF;
END $$;


-- ── 2. Add contract_price to lots ────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lots' AND column_name = 'contract_price'
  ) THEN
    ALTER TABLE lots ADD COLUMN contract_price numeric(10,2);
  END IF;
END $$;


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
