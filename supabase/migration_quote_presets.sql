-- =============================================================================
-- Earthcare Landscapes — Migration: quote presets (quote builder templates)
--
-- Adds reusable starting-point templates for the Quotes page builder
-- ("Start blank" vs. picking a preset like "Large Works"). Deliberately named
-- quote_presets / quote_preset_sections / quote_preset_items — NOT
-- quote_template_* — because quote_template_sections / quote_template_items
-- already exist (see migration_phase2.sql / schema.sql) for a completely
-- different feature: the master template that drives the per-lot quant sheet
-- (has unit_price, is_client_extra, auto_calc_formula, plant_category, etc).
-- These new tables instead mirror the shape of quotes/quote_sections/
-- quote_line_items (description, qty, unit, rate) — a preset is just a
-- reusable set of default sections + line items to copy into a new quote.
--
-- RLS: all internal staff can read (supervisors+ create quotes and need to
-- see what templates are available); only admins can write — same pattern
-- as quote_template_sections/quote_template_items.
--
-- Safe to run multiple times.
-- =============================================================================

CREATE TABLE IF NOT EXISTS quote_presets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_default  boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_presets: internal users read" ON quote_presets;
CREATE POLICY "quote_presets: internal users read"
  ON quote_presets FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "quote_presets: admin write" ON quote_presets;
CREATE POLICY "quote_presets: admin write"
  ON quote_presets FOR ALL
  USING (current_user_role() = 'admin');


CREATE TABLE IF NOT EXISTS quote_preset_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id   uuid NOT NULL REFERENCES quote_presets(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS qpts_preset_id_idx ON quote_preset_sections(preset_id);

ALTER TABLE quote_preset_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_preset_sections: internal users read" ON quote_preset_sections;
CREATE POLICY "quote_preset_sections: internal users read"
  ON quote_preset_sections FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "quote_preset_sections: admin write" ON quote_preset_sections;
CREATE POLICY "quote_preset_sections: admin write"
  ON quote_preset_sections FOR ALL
  USING (current_user_role() = 'admin');


CREATE TABLE IF NOT EXISTS quote_preset_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES quote_preset_sections(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  qty         numeric NOT NULL DEFAULT 1,
  unit        text NOT NULL DEFAULT '',
  rate        numeric NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS qpti_section_id_idx ON quote_preset_items(section_id);

ALTER TABLE quote_preset_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_preset_items: internal users read" ON quote_preset_items;
CREATE POLICY "quote_preset_items: internal users read"
  ON quote_preset_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "quote_preset_items: admin write" ON quote_preset_items;
CREATE POLICY "quote_preset_items: admin write"
  ON quote_preset_items FOR ALL
  USING (current_user_role() = 'admin');


-- =============================================================================
-- Seed data — "Preliminaries only" (small jobs) and "Large Works"
-- Guarded by name lookups so re-running this migration doesn't duplicate rows.
-- =============================================================================

DO $$
DECLARE
  v_preset_id  uuid;
  v_section_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM quote_presets WHERE name = 'Preliminaries only') THEN
    INSERT INTO quote_presets (name, description, is_default, order_index)
    VALUES ('Preliminaries only', 'Small jobs', false, 0)
    RETURNING id INTO v_preset_id;

    INSERT INTO quote_preset_sections (preset_id, name, order_index)
    VALUES (v_preset_id, 'PRELIMINARIES', 0)
    RETURNING id INTO v_section_id;

    INSERT INTO quote_preset_items (section_id, description, qty, unit, rate, order_index) VALUES
      (v_section_id, 'Insurance', 1, 'item', 225, 0),
      (v_section_id, 'Project Management, Supervision, Admin', 1, 'item', 500, 1),
      (v_section_id, 'Site Survey & Set Up', 1, 'item', 0, 2),
      (v_section_id, 'Clean up', 1, 'item', 200, 3);
  END IF;
END $$;

DO $$
DECLARE
  v_preset_id  uuid;
  v_section_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM quote_presets WHERE name = 'Large Works') THEN
    INSERT INTO quote_presets (name, description, is_default, order_index)
    VALUES ('Large Works', NULL, false, 1)
    RETURNING id INTO v_preset_id;

    INSERT INTO quote_preset_sections (preset_id, name, order_index)
    VALUES (v_preset_id, 'PRELIMINARIES', 0)
    RETURNING id INTO v_section_id;
    INSERT INTO quote_preset_items (section_id, description, qty, unit, rate, order_index) VALUES
      (v_section_id, 'Insurance', 1, 'item', 225, 0),
      (v_section_id, 'Project Management, Supervision, Admin', 1, 'item', 500, 1),
      (v_section_id, 'Site Survey & Set Up', 1, 'item', 0, 2),
      (v_section_id, 'Clean up', 1, 'item', 200, 3);

    INSERT INTO quote_preset_sections (preset_id, name, order_index)
    VALUES (v_preset_id, 'IRRIGATION', 1)
    RETURNING id INTO v_section_id;
    INSERT INTO quote_preset_items (section_id, description, qty, unit, rate, order_index) VALUES
      (v_section_id, '', 1, 'Lm', 0, 0);

    INSERT INTO quote_preset_sections (preset_id, name, order_index)
    VALUES (v_preset_id, 'SOFTSCAPE WORKS', 2)
    RETURNING id INTO v_section_id;
    INSERT INTO quote_preset_items (section_id, description, qty, unit, rate, order_index) VALUES
      (v_section_id, 'Limestone mulch', 1, 'm²', 0, 0),
      (v_section_id, 'Steel Edging', 1, 'lm', 0, 1),
      (v_section_id, 'Planting', 1, 'unit', 0, 2);

    INSERT INTO quote_preset_sections (preset_id, name, order_index)
    VALUES (v_preset_id, 'EARTHWORKS', 3)
    RETURNING id INTO v_section_id;
    INSERT INTO quote_preset_items (section_id, description, qty, unit, rate, order_index) VALUES
      (v_section_id, 'Fine Grading', 1, 'item', 0, 0),
      (v_section_id, 'Additional infill required for levels', 1, 'hr', 0, 1);
  END IF;
END $$;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
