-- =============================================================================
-- Earthcare Landscapes — Migration: invoice_runs PDF snapshots
-- Stores the claim-sheet PDF generated at the moment of invoicing, so invoice
-- history can show exactly what was claimed even after the underlying quant
-- sheet changes later.
-- Run in Supabase SQL Editor → New query.
-- Safe to run multiple times — uses IF NOT EXISTS throughout.
-- =============================================================================

-- { lot_id: r2_path } — e.g. { "abc-123": "invoice-snapshots/1730000000000/abc-123.pdf" }
ALTER TABLE invoice_runs ADD COLUMN IF NOT EXISTS snapshot_paths jsonb DEFAULT '{}';

-- Already present in every environment we've checked (markAsInvoiced has
-- always set it on insert) — included for completeness/safety.
ALTER TABLE invoice_runs ADD COLUMN IF NOT EXISTS invoiced_at timestamptz DEFAULT now();

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
