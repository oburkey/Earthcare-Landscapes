-- House Types catalogue — admin-managed reference table of house designs and
-- their standard areas. Providence-specific for now (developer defaults to
-- 'Providence') but generic so other developers/clients can have their own
-- house types later.

CREATE TABLE IF NOT EXISTS house_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer       text NOT NULL DEFAULT 'Providence',
  name            text NOT NULL,
  size            text NOT NULL CHECK (size IN ('S', 'M', 'L')),
  site_area       numeric(8, 2),
  turf_area       numeric(8, 2),
  softworks_area  numeric(8, 2),
  alfresco_area   numeric(8, 2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (developer, name)
);

DROP TRIGGER IF EXISTS house_types_updated_at ON house_types;
CREATE TRIGGER house_types_updated_at
  BEFORE UPDATE ON house_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE house_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house_types: admin full access" ON house_types;
CREATE POLICY "house_types: admin full access"
  ON house_types FOR ALL
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "house_types: staff read" ON house_types;
CREATE POLICY "house_types: staff read"
  ON house_types FOR SELECT
  USING (current_user_role() IN ('worker', 'leading_hand', 'supervisor', 'admin'));

-- Seed: Providence designs. Safe to re-run — conflicts on (developer, name) are ignored.
INSERT INTO house_types (developer, name, size, site_area, turf_area, softworks_area, alfresco_area) VALUES
  ('Providence', 'Billie Jean',     'S', 235,  27,   52,   20.52),
  ('Providence', 'Cecilia',         'S', 160,  17,   24,   12.07),
  ('Providence', 'Day Dream',       'S', 218,  22,   47,   10.69),
  ('Providence', 'Tiny Dancer',     'S', 198,  27,   39,   14.11),
  ('Providence', 'Your Song',       'S', 270,  44,   50,   12.98),
  ('Providence', 'Dream Catcher',   'M', NULL, NULL, NULL, 13.6),
  ('Providence', 'Alive & Well',    'M', 218,  14,   27,   12.35),
  ('Providence', 'Sunshine',        'M', 299,  33,   49,   23.13),
  ('Providence', 'Sweet Dreams',    'M', 233,  16,   24,   10.81),
  ('Providence', 'Party Time',      'M', 397,  NULL, NULL, 20.88),
  ('Providence', 'Seventh Heaven',  'M', 280,  23,   37,   16.5),
  ('Providence', 'Brightside',      'L', 243,  21,   23,   13.37),
  ('Providence', 'Feeling Groovy',  'L', 287,  17,   25,   36.33),
  ('Providence', 'Moonshadow',      'L', 271,  21,   47,   16.5)
ON CONFLICT (developer, name) DO NOTHING;
