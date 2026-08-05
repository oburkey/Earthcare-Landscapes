-- =============================================================================
-- Earthcare Landscapes — Migration: Quote sections
-- Adds named sections (with subtotals) to the /quotes sales-quote builder.
-- Run in Supabase SQL Editor → New query.
-- Steps 1-2 are safe to run multiple times. Step 3 (backfill) should only be
-- run ONCE — re-running it will duplicate sections for quotes that already
-- got a backfilled "Items" section.
-- =============================================================================

-- ── 1. Sections belonging to a quote ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quote_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_sections_quote_id_idx ON quote_sections(quote_id);
ALTER TABLE quote_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_sections: supervisor+ full access" ON quote_sections;
CREATE POLICY "quote_sections: supervisor+ full access"
  ON quote_sections FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

-- ── 2. Line items belonging to a section (replaces quotes.line_items jsonb) ──

CREATE TABLE IF NOT EXISTS quote_line_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES quote_sections(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  qty         numeric(10,3) NOT NULL DEFAULT 0,
  unit        text NOT NULL DEFAULT 'hr',
  rate        numeric(10,2) NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_line_items_section_id_idx ON quote_line_items(section_id);
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_line_items: supervisor+ full access" ON quote_line_items;
CREATE POLICY "quote_line_items: supervisor+ full access"
  ON quote_line_items FOR ALL
  USING (current_user_role() IN ('supervisor', 'admin'));

-- ── 3. Backfill existing quotes' flat line_items into one default section ──
-- Section name is left blank ('') — the app shows no header row for an
-- unnamed section, it's purely a container for the migrated items.
-- quotes.line_items is left in place afterward (deprecated, unused by the
-- app going forward) — not dropped, per project policy against deleting
-- columns/data without explicit confirmation.

DO $$
DECLARE
  q RECORD;
  new_section_id uuid;
  item jsonb;
  idx integer;
BEGIN
  FOR q IN SELECT id, line_items FROM quotes WHERE jsonb_array_length(COALESCE(line_items, '[]'::jsonb)) > 0 LOOP
    INSERT INTO quote_sections (quote_id, name, order_index)
    VALUES (q.id, '', 0)
    RETURNING id INTO new_section_id;

    idx := 0;
    FOR item IN SELECT * FROM jsonb_array_elements(q.line_items) LOOP
      INSERT INTO quote_line_items (section_id, description, qty, unit, rate, order_index)
      VALUES (
        new_section_id,
        COALESCE(item->>'description', ''),
        COALESCE((item->>'qty')::numeric, 0),
        COALESCE(item->>'unit', 'hr'),
        COALESCE((item->>'rate')::numeric, 0),
        idx
      );
      idx := idx + 1;
    END LOOP;
  END LOOP;
END $$;

-- ── 4. Corrective fix — you already ran this migration once, so any
--    backfilled sections in your database are currently named "Items".
--    Run this once to clear that default so those sections render with no
--    header row too, matching the current behaviour for new quotes.

UPDATE quote_sections SET name = '' WHERE name = 'Items';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
