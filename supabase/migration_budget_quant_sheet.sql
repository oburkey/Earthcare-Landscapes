-- =============================================================================
-- Earthcare Landscapes — Migration: Budget quant sheet + estimate admin-only
-- 1. Adds quote_type ('estimate' | 'budget' | 'final') alongside the existing
--    is_estimated boolean, migrates existing rows, and moves the uniqueness
--    guarantee from (lot_id, is_estimated) to (lot_id, quote_type).
-- 2. Locks the estimate quant sheet — and its line items — to admin only at
--    the RLS layer. Budget and final stay leading_hand+, same as today.
--
-- is_estimated is left in place, NOT dropped. App code (quote-actions.ts,
-- lib/data.ts, analytics/lib.ts, StageLotsTable.tsx, MaterialsSummary.tsx)
-- still reads/writes it and hasn't been touched as part of this migration —
-- dropping it now would break those queries before the code cutover ships.
-- Once app code is fully moved onto quote_type, drop is_estimated in a
-- follow-up migration (needs explicit confirmation per project rules).
--
-- Safe to run multiple times.
-- =============================================================================


-- ── 1. quote_type column ─────────────────────────────────────────────────────

ALTER TABLE lot_quotes ADD COLUMN IF NOT EXISTS quote_type text;

UPDATE lot_quotes
SET quote_type = CASE WHEN is_estimated THEN 'estimate' ELSE 'final' END
WHERE quote_type IS NULL;

ALTER TABLE lot_quotes ALTER COLUMN quote_type SET DEFAULT 'final';
ALTER TABLE lot_quotes ALTER COLUMN quote_type SET NOT NULL;

ALTER TABLE lot_quotes DROP CONSTRAINT IF EXISTS lot_quotes_quote_type_check;
ALTER TABLE lot_quotes ADD CONSTRAINT lot_quotes_quote_type_check
  CHECK (quote_type IN ('estimate', 'budget', 'final'));


-- ── 2. Unique constraint: (lot_id, is_estimated) → (lot_id, quote_type) ─────

ALTER TABLE lot_quotes DROP CONSTRAINT IF EXISTS lot_quotes_lot_id_is_estimated_key;
ALTER TABLE lot_quotes ADD CONSTRAINT lot_quotes_lot_id_quote_type_key UNIQUE (lot_id, quote_type);


-- ── 3. RLS: estimate becomes admin-only; budget/final stay leading_hand+ ───

DROP POLICY IF EXISTS "lot_quotes: leading_hand+ access" ON lot_quotes;

CREATE POLICY "lot_quotes: leading_hand+ access to budget/final"
  ON lot_quotes FOR ALL
  USING (
    quote_type <> 'estimate'
    AND current_user_role() IN ('leading_hand', 'supervisor', 'admin')
  );

CREATE POLICY "lot_quotes: admin access to estimate"
  ON lot_quotes FOR ALL
  USING (
    quote_type = 'estimate'
    AND current_user_role() = 'admin'
  );

-- lot_quote_items has no quote_type of its own — it must check its parent
-- lot_quotes row so estimate line items get the same admin-only gate.
-- Without this, leading_hand/supervisor could still read/write estimate
-- line items directly even though the estimate quote row itself is locked.

DROP POLICY IF EXISTS "lot_quote_items: leading_hand+ access" ON lot_quote_items;

CREATE POLICY "lot_quote_items: leading_hand+ access to budget/final"
  ON lot_quote_items FOR ALL
  USING (
    current_user_role() IN ('leading_hand', 'supervisor', 'admin')
    AND EXISTS (
      SELECT 1 FROM lot_quotes q
      WHERE q.id = lot_quote_items.quote_id AND q.quote_type <> 'estimate'
    )
  );

CREATE POLICY "lot_quote_items: admin access to estimate"
  ON lot_quote_items FOR ALL
  USING (
    current_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM lot_quotes q
      WHERE q.id = lot_quote_items.quote_id AND q.quote_type = 'estimate'
    )
  );

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
