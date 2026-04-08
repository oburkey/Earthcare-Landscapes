-- =============================================================================
-- Earthcare Landscapes — Phase 2 Re-seed: Correct Pricing Template
-- WARNING: This clears ALL existing quote template data and any saved lot quotes.
-- Run once after migration_phase2.sql has been applied.
-- =============================================================================

-- ── 1. Add admin_only column to sections (safe to re-run) ─────────────────────
ALTER TABLE quote_template_sections
  ADD COLUMN IF NOT EXISTS admin_only boolean NOT NULL DEFAULT false;

-- ── 2. Clear existing data ────────────────────────────────────────────────────
DELETE FROM lot_quote_items;
DELETE FROM lot_quotes;
DELETE FROM quote_template_items;
DELETE FROM quote_template_sections;

-- ── 3. Re-seed ────────────────────────────────────────────────────────────────
--
-- Unit semantics:
--   'ITEM'   – fixed price item, always qty=1, no user input
--   'toggle' – yes/no inclusion toggle, qty saved as 1 (yes) or 0 (no)
--   'No.'    – numeric quantity input (whole or decimal)
--   'm²'     – square metres (numeric input)
--   'm³'     – cubic metres (numeric input)
--   'Lm'     – linear metres (numeric input)
--   'tonne'  – tonnes (numeric input)
--
-- auto_calc_formula semantics (re-used for UI metadata on non-auto items):
--   'front_plants' | 'rear_plants' | 'all_plants' | 'all_plants_x0.5'
--       → item is auto-calculated from plant quantities
--   'variant_group:<name>'
--       → two items in this group form a mutually-exclusive pair (stepper toggle)
--   'corner_lot_flag'
--       → this toggle controls visibility of show_if_corner_lot items
--   'show_if_corner_lot'
--       → item only visible when the corner_lot_flag toggle is YES
--
-- plant_category: 'front' | 'rear' | NULL
--   Tags plant items so the stage summary can aggregate plant counts.

DO $$
DECLARE
  s_prelim   uuid;
  s_earth    uuid;
  s_hard     uuid;
  s_soft_f   uuid;
  s_irr_f    uuid;
  s_rear     uuid;
  s_extras   uuid;
BEGIN

  -- ── Sections ────────────────────────────────────────────────────────────────

  INSERT INTO quote_template_sections (name, order_index, admin_only)
    VALUES ('Preliminaries', 0, true)   RETURNING id INTO s_prelim;

  INSERT INTO quote_template_sections (name, order_index, admin_only)
    VALUES ('Earthworks', 1, false)     RETURNING id INTO s_earth;

  INSERT INTO quote_template_sections (name, order_index, admin_only)
    VALUES ('Hardscape Works — Front', 2, false) RETURNING id INTO s_hard;

  INSERT INTO quote_template_sections (name, order_index, admin_only)
    VALUES ('Softscape Works — Front', 3, false) RETURNING id INTO s_soft_f;

  INSERT INTO quote_template_sections (name, order_index, admin_only)
    VALUES ('Irrigation — Front', 4, false) RETURNING id INTO s_irr_f;

  INSERT INTO quote_template_sections (name, order_index, admin_only)
    VALUES ('Rear & Side Lot', 5, false) RETURNING id INTO s_rear;

  INSERT INTO quote_template_sections (name, order_index, admin_only)
    VALUES ('Client Extras', 6, false)  RETURNING id INTO s_extras;


  -- ── Preliminaries (admin-only, fixed price) ──────────────────────────────────

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, order_index)
  VALUES
    (s_prelim, 'Insurance',                          'ITEM', 105.00, 0),
    (s_prelim, 'Project Management & Supervision',   'ITEM', 350.00, 1),
    (s_prelim, 'Design changes and updating',        'ITEM', 150.00, 2),
    (s_prelim, 'Site Survey & Set Up',               'ITEM', 150.00, 3);


  -- ── Earthworks ───────────────────────────────────────────────────────────────

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, order_index)
  VALUES
    (s_earth, 'Fine Grading',                        'm²',   4.00,  0),
    (s_earth, 'Additional infill required for levels','m³',  85.00, 1);


  -- ── Hardscape Works — Front ───────────────────────────────────────────────────
  -- Steppers are a variant pair: only one type is used per lot.

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, auto_calc_formula, order_index)
  VALUES
    (s_hard, 'Steppers 600×400mm', 'No.', 70.00, 'variant_group:front_steppers', 0),
    (s_hard, 'Steppers 400×400mm', 'No.', 55.00, 'variant_group:front_steppers', 1);

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, order_index)
  VALUES
    (s_hard, 'Feature Boulders',      'tonne', 310.00, 2),
    (s_hard, 'Steel Edging',          'Lm',     50.00, 3),
    (s_hard, 'Artificial Turf',       'm²',    120.00, 4),
    (s_hard, 'Services Protection',   'ITEM',  120.00, 5);


  -- ── Softscape Works — Front ───────────────────────────────────────────────────

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, plant_category, order_index)
  VALUES
    (s_soft_f, '130mm plants',            'No.',  18.50, 'front', 0),
    (s_soft_f, '200mm plants',            'No.',  29.00, 'front', 1),
    (s_soft_f, '300mm plants',            'No.',  75.00, 'front', 2),
    (s_soft_f, 'Feature Trees 90L',       'No.', 465.00, 'front', 3),
    (s_soft_f, 'Feature Trees 45L',       'No.', 245.00, 'front', 4);

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, order_index)
  VALUES
    (s_soft_f, 'Mulch Limestone 32mm',        'm²',  22.00, 5),
    (s_soft_f, 'Laterite compacted gravel',   'm²',  28.00, 6),
    (s_soft_f, 'Black Mulch',                 'm²',  42.00, 7),
    (s_soft_f, 'White Mulch',                 'm²', 130.00, 8);


  -- ── Irrigation — Front (toggle: included / excluded) ─────────────────────────
  -- "Corner lot addition" only appears when the corner lot flag (in Rear section)
  -- is set to YES.

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, order_index)
  VALUES
    (s_irr_f, 'Dripper Irrigation front',  'toggle', 550.00, 0),
    (s_irr_f, 'Solenoid / Plumber cut in', 'toggle', 345.00, 1),
    (s_irr_f, 'Pre-lay and cables',        'toggle', 145.00, 2),
    (s_irr_f, 'Controller and cables',     'toggle', 290.00, 3);

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, auto_calc_formula, order_index)
  VALUES
    (s_irr_f, 'Corner lot addition', 'toggle', 350.00, 'show_if_corner_lot', 4);


  -- ── Rear & Side Lot ───────────────────────────────────────────────────────────
  -- "Corner lot" toggle controls visibility of the corner lot irrigation item.
  -- Steppers follow the same variant-pair pattern as front.

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, auto_calc_formula, order_index)
  VALUES
    (s_rear, 'Corner lot', 'toggle', 0.00, 'corner_lot_flag', 0);

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, plant_category, order_index)
  VALUES
    (s_rear, '130mm plants',  'No.',  18.50, 'rear', 1),
    (s_rear, '5L plants',     'No.',  28.50, 'rear', 2),
    (s_rear, '300mm plants',  'No.',  75.00, 'rear', 3);

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, order_index)
  VALUES
    (s_rear, 'Limestone Mulch',         'm²',  22.50, 4),
    (s_rear, 'Laterite Gravel Mulch',   'm²',  27.50, 5),
    (s_rear, 'Black Mulch',             'm²',  42.00, 6);

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, auto_calc_formula, order_index)
  VALUES
    (s_rear, 'Steppers 600×400mm', 'No.', 70.00, 'variant_group:rear_steppers', 7),
    (s_rear, 'Steppers 400×400mm', 'No.', 55.00, 'variant_group:rear_steppers', 8);

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, order_index)
  VALUES
    (s_rear, 'Artificial Turf',       'm²',  120.00,  9),
    (s_rear, 'Edging',                'Lm',   50.00, 10),
    (s_rear, 'Small Trees',           'No.', 140.00, 11),
    (s_rear, 'Fruit Trees',           'No.',  55.00, 12),
    (s_rear, 'Rear & Side Irrigation','toggle', 350.00, 13);


  -- ── Client Extras ─────────────────────────────────────────────────────────────

  INSERT INTO quote_template_items
    (section_id, name, unit, unit_price, order_index)
  VALUES
    (s_extras, 'Artificial turf rear', 'm²', 120.00, 0),
    (s_extras, 'Edging',               'Lm',  48.00, 1);

END $$;

-- =============================================================================
-- END OF SEED
-- =============================================================================
