-- =============================================================================
-- Earthcare Landscapes — Phase 2: Quoting & Materials System
-- Safe to run multiple times.
-- =============================================================================


-- ── 1. quote_template_sections ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quote_template_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_template_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qts: internal users read" ON quote_template_sections;
CREATE POLICY "qts: internal users read"
  ON quote_template_sections FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "qts: admin write" ON quote_template_sections;
CREATE POLICY "qts: admin write"
  ON quote_template_sections FOR ALL
  USING (current_user_role() = 'admin');


-- ── 2. quote_template_items ───────────────────────────────────────────────────
-- unit values: 'No.' | 'm²' | 'm³' | 'Lin M' | 'toggle' | 'auto'
-- plant_category drives irrigation auto-calc: 'front' = Softscape Front plants,
--   'rear' = Softscape Rear plants. NULL = not a plant item.
-- auto_calc_formula: 'front_plants' | 'rear_plants' | 'all_plants' | 'all_plants_x0.5'

CREATE TABLE IF NOT EXISTS quote_template_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id         uuid NOT NULL REFERENCES quote_template_sections(id) ON DELETE CASCADE,
  name               text NOT NULL,
  unit               text NOT NULL DEFAULT 'No.',
  unit_price         numeric(10,2),
  is_auto_calculated boolean NOT NULL DEFAULT false,
  auto_calc_formula  text,
  plant_category     text CHECK (plant_category IN ('front', 'rear')),
  order_index        integer NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qti_section_id_idx ON quote_template_items(section_id);

ALTER TABLE quote_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qti: internal users read" ON quote_template_items;
CREATE POLICY "qti: internal users read"
  ON quote_template_items FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

DROP POLICY IF EXISTS "qti: admin write" ON quote_template_items;
CREATE POLICY "qti: admin write"
  ON quote_template_items FOR ALL
  USING (current_user_role() = 'admin');


-- ── 3. lot_quotes ─────────────────────────────────────────────────────────────
-- is_estimated = true  → pre-job estimate (filled before works start)
-- is_estimated = false → final actual quantities (filled on completion)
-- One of each type per lot, enforced by the unique constraint.

CREATE TABLE IF NOT EXISTS lot_quotes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id       uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  is_estimated boolean NOT NULL DEFAULT true,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  quoted_by    uuid REFERENCES profiles(id),
  quoted_at    timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lot_id, is_estimated)
);

CREATE INDEX IF NOT EXISTS lot_quotes_lot_id_idx ON lot_quotes(lot_id);

CREATE OR REPLACE TRIGGER lot_quotes_updated_at
  BEFORE UPDATE ON lot_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE lot_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_quotes: leading_hand+ access" ON lot_quotes;
CREATE POLICY "lot_quotes: leading_hand+ access"
  ON lot_quotes FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));


-- ── 4. lot_quote_items ────────────────────────────────────────────────────────
-- item_name / unit / unit_price_snapshot are snapshots taken at save time so
-- historical quotes remain accurate if the template is later changed.
-- Auto-calculated quantities (e.g. drippers) are also stored here so the
-- stage summary can aggregate them without re-computing.

CREATE TABLE IF NOT EXISTS lot_quote_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            uuid NOT NULL REFERENCES lot_quotes(id) ON DELETE CASCADE,
  template_item_id    uuid REFERENCES quote_template_items(id),
  item_name           text NOT NULL,
  unit                text NOT NULL,
  quantity            numeric(10,3),
  unit_price_snapshot numeric(10,2),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, template_item_id)
);

CREATE INDEX IF NOT EXISTS lqi_quote_id_idx ON lot_quote_items(quote_id);

ALTER TABLE lot_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lot_quote_items: leading_hand+ access" ON lot_quote_items;
CREATE POLICY "lot_quote_items: leading_hand+ access"
  ON lot_quote_items FOR ALL
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));


-- =============================================================================
-- SEED: Default template — only runs if no sections exist yet.
-- =============================================================================

DO $$
DECLARE
  s_earthworks      uuid;
  s_hardscape       uuid;
  s_softscape_front uuid;
  s_softscape_rear  uuid;
  s_irrigation      uuid;
  s_client_extras   uuid;
BEGIN

  IF EXISTS (SELECT 1 FROM quote_template_sections LIMIT 1) THEN
    RETURN;
  END IF;

  -- Sections
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Earthworks', 0)             RETURNING id INTO s_earthworks;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Hardscape Works', 1)         RETURNING id INTO s_hardscape;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Softscape Front', 2)         RETURNING id INTO s_softscape_front;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Softscape Rear & Side', 3)   RETURNING id INTO s_softscape_rear;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Irrigation', 4)              RETURNING id INTO s_irrigation;
  INSERT INTO quote_template_sections (name, order_index) VALUES ('Client Extras', 5)           RETURNING id INTO s_client_extras;

  -- Earthworks
  INSERT INTO quote_template_items (section_id, name, unit, order_index) VALUES
    (s_earthworks, 'Fine grading',          'm²',  0),
    (s_earthworks, 'Extra earthworks',      'm²',  1),
    (s_earthworks, 'Extra works/comment',   'No.', 2);

  -- Hardscape Works
  INSERT INTO quote_template_items (section_id, name, unit, order_index) VALUES
    (s_hardscape, 'Moss rock installed',          'Lin M', 0),
    (s_hardscape, 'Steppers 600x300mm',           'No.',   1),
    (s_hardscape, 'Large boulders',               'No.',   2),
    (s_hardscape, 'Small pitching',               'Lin M', 3),
    (s_hardscape, 'Steel edging to mulch areas',  'Lin M', 4);

  -- Softscape Front (plant items tagged with plant_category = 'front')
  INSERT INTO quote_template_items (section_id, name, unit, plant_category, order_index) VALUES
    (s_softscape_front, '130mm plants',                      'No.',   'front', 0),
    (s_softscape_front, '175-200mm plants',                  'No.',   'front', 1),
    (s_softscape_front, '300mm pot plants',                  'No.',   'front', 2),
    (s_softscape_front, 'Street tree 90L',                   'No.',   null,    3),
    (s_softscape_front, 'Street tree 35Lt',                  'No.',   null,    4),
    (s_softscape_front, 'Artificial turf',                   'm²',    null,    5),
    (s_softscape_front, 'Steel edging to turf',              'Lin M', null,    6),
    (s_softscape_front, 'Mulch - Limestone 32mm',            'm²',    null,    7),
    (s_softscape_front, 'Mulch - Red gravel',                'm²',    null,    8),
    (s_softscape_front, 'Mulch - Black',                     'm²',    null,    9),
    (s_softscape_front, 'Mulch - Grey',                      'm²',    null,    10),
    (s_softscape_front, 'Rock mulch around A/C and services','No.',   null,    11),
    (s_softscape_front, 'Other',                             'No.',   null,    12);

  -- Softscape Rear & Side
  -- 'Corner lot' uses unit='toggle' — renders as YES/NO, value stored as 1/0
  INSERT INTO quote_template_items (section_id, name, unit, plant_category, order_index) VALUES
    (s_softscape_rear, 'Corner lot',                      'toggle', null,   0),
    (s_softscape_rear, '130mm plants',                    'No.',    'rear', 1),
    (s_softscape_rear, '175-200mm plants',                'No.',    'rear', 2),
    (s_softscape_rear, '300mm pot plants',                'No.',    'rear', 3),
    (s_softscape_rear, 'Other larger plant stock - size', 'No.',    'rear', 4),
    (s_softscape_rear, 'Limestone stone mulch',           'm²',     null,   5),
    (s_softscape_rear, 'Black mulch',                     'm²',     null,   6),
    (s_softscape_rear, 'Steppers 600x300mm',              'No.',    null,   7),
    (s_softscape_rear, 'Small tree - size and type',      'No.',    null,   8),
    (s_softscape_rear, 'Other',                           'No.',    null,   9);

  -- Irrigation — all auto-calculated, read-only in the form
  INSERT INTO quote_template_items (section_id, name, unit, is_auto_calculated, auto_calc_formula, order_index) VALUES
    (s_irrigation, 'Front drippers',        'No.',   true, 'front_plants',    0),
    (s_irrigation, 'Back drippers',         'No.',   true, 'rear_plants',     1),
    (s_irrigation, 'Jabs',                  'No.',   true, 'all_plants',      2),
    (s_irrigation, 'Dripper tube estimate', 'Lin M', true, 'all_plants_x0.5', 3);

  -- Client Extras
  INSERT INTO quote_template_items (section_id, name, unit, order_index) VALUES
    (s_client_extras, 'Artificial turf rear', 'm²',    0),
    (s_client_extras, 'Steel edging to turf', 'Lin M', 1),
    (s_client_extras, 'Other',                'No.',   2);

END $$;


-- =============================================================================
-- END OF PHASE 2 MIGRATION
-- =============================================================================
