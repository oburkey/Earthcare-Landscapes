-- House/home design name per lot (e.g. "Billie Jean"). Free text for now —
-- will be standardised against house_types once that catalogue is adopted.
ALTER TABLE lots ADD COLUMN IF NOT EXISTS home_design text;
