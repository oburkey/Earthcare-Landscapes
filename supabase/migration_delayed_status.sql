-- =============================================================================
-- Earthcare Landscapes — Migration: "Delayed" flag for lots and extra jobs
-- Adds an independent delayed/delay_reason pair to both tables — separate
-- from lot status (which already has 'on_hold') and extra_jobs.status
-- ('not_started' | 'in_progress' | 'complete', no on_hold). "Delayed" means
-- behind schedule with a stated reason; it's orthogonal to status, not a
-- replacement for it.
-- No RLS changes needed — "lots: leading_hands write" and "extra_jobs:
-- leading_hands and above write" already grant leading_hand+ full UPDATE
-- access on these tables, which covers the new columns too.
-- Safe to run multiple times.
-- =============================================================================

ALTER TABLE lots ADD COLUMN IF NOT EXISTS delayed boolean NOT NULL DEFAULT false;
ALTER TABLE lots ADD COLUMN IF NOT EXISTS delay_reason text;

ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS delayed boolean NOT NULL DEFAULT false;
ALTER TABLE extra_jobs ADD COLUMN IF NOT EXISTS delay_reason text;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
