-- =============================================================================
-- Earthcare Landscapes — Migration: RLS hardening (lots, extra jobs, stages)
--
-- 1. lots: admin-only delete. Leading hands and supervisors keep insert and
--    update; "workers update own status" is dropped (assigned_worker_id isn't
--    used anywhere in the app, so only "workers update status" ever applied).
-- 2. lots_guard_columns trigger:
--      - contract_price, invoiced, approved_for_invoicing,
--        approved_for_invoicing_at, has_client_extras → admin only
--      - pending_review → admin, except leading hand+ may set it to true
--        (saving a final quant sheet flags the lot for review)
--      - workers may only change status, notes, completion_date, updated_by
--      - non-admin inserts must leave the pricing/invoicing columns at their
--        defaults
-- 3. extra_jobs: admin-only delete, and extra_jobs_guard_columns makes
--    invoiced, approved_for_invoicing, approved_for_invoicing_at,
--    pending_review, finance_notes and approved_by_name admin only.
-- 4. stages_guard_pricing: is_contract_pricing and default_contract_price
--    admin only.
--
-- Matching app changes (deploy together, after running this):
--   - EditLotForm / updateLot: contract price is admin-only
--   - EditStageForm / updateStage: contract pricing is admin-only; the
--     "fill empty lot prices from the stage default" step runs for admin only
--
-- Server-side writes using the service-role client (auth.uid() IS NULL) and
-- the SQL editor bypass the triggers. Requires changed_columns() from
-- migration_rls_invites_profiles.sql — run that one first.
--
-- Run in Supabase SQL Editor → New query. Safe to run multiple times.
-- =============================================================================


-- ── 1. lots policies ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "lots: workers update own status"     ON lots;
DROP POLICY IF EXISTS "lots: leading_hands write"           ON lots;
DROP POLICY IF EXISTS "lots: supervisors and admins write"  ON lots;
DROP POLICY IF EXISTS "lots: leading_hand+ insert"          ON lots;
DROP POLICY IF EXISTS "lots: leading_hand+ update"          ON lots;
DROP POLICY IF EXISTS "lots: admin delete"                  ON lots;

-- Read policies ("workers and leading_hands read all", "supervisors and
-- admins read all", "clients read permitted lots") and "workers update
-- status" are unchanged.

CREATE POLICY "lots: leading_hand+ insert"
  ON lots FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

CREATE POLICY "lots: leading_hand+ update"
  ON lots FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

CREATE POLICY "lots: admin delete"
  ON lots FOR DELETE
  USING (current_user_role() = 'admin');


-- ── 2. lots column guard ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION lots_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r          role;
  admin_cols text[] := ARRAY['contract_price', 'invoiced', 'approved_for_invoicing',
                             'approved_for_invoicing_at', 'has_client_extras'];
  bad        text[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;   -- service role / SQL editor
  r := current_user_role();
  IF r = 'admin' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.contract_price IS NOT NULL
       OR NEW.invoiced
       OR NEW.approved_for_invoicing
       OR NEW.approved_for_invoicing_at IS NOT NULL
       OR NEW.pending_review
       OR NOT NEW.has_client_extras THEN
      RAISE EXCEPTION 'Only admins can set pricing or invoicing fields on a new lot'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF r = 'worker' THEN
    bad := changed_columns(to_jsonb(OLD), to_jsonb(NEW),
             ARRAY['status', 'notes', 'completion_date', 'updated_by', 'updated_at']);
  ELSE
    bad := ARRAY(
      SELECT c FROM unnest(admin_cols) c
      WHERE (to_jsonb(NEW) -> c) IS DISTINCT FROM (to_jsonb(OLD) -> c)
    );
    -- Leading hand+ may flag a lot for review, but not clear the flag
    IF NEW.pending_review IS DISTINCT FROM OLD.pending_review AND NOT NEW.pending_review THEN
      bad := bad || 'pending_review';
    END IF;
    IF cardinality(bad) = 0 THEN bad := NULL; END IF;
  END IF;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Not allowed to change lot field(s): %', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lots_guard_columns ON lots;
CREATE TRIGGER lots_guard_columns
  BEFORE INSERT OR UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION lots_guard_columns();


-- ── 3. extra_jobs policies + column guard ───────────────────────────────────

DROP POLICY IF EXISTS "extra_jobs: leading_hands and above write" ON extra_jobs;
DROP POLICY IF EXISTS "extra_jobs: leading_hand+ insert"          ON extra_jobs;
DROP POLICY IF EXISTS "extra_jobs: leading_hand+ update"          ON extra_jobs;
DROP POLICY IF EXISTS "extra_jobs: admin delete"                  ON extra_jobs;

-- Read policies ("staff read all", "clients read permitted") are unchanged.

CREATE POLICY "extra_jobs: leading_hand+ insert"
  ON extra_jobs FOR INSERT
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

CREATE POLICY "extra_jobs: leading_hand+ update"
  ON extra_jobs FOR UPDATE
  USING (current_user_role() IN ('leading_hand', 'supervisor', 'admin'))
  WITH CHECK (current_user_role() IN ('leading_hand', 'supervisor', 'admin'));

CREATE POLICY "extra_jobs: admin delete"
  ON extra_jobs FOR DELETE
  USING (current_user_role() = 'admin');

CREATE OR REPLACE FUNCTION extra_jobs_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  admin_cols text[] := ARRAY['invoiced', 'approved_for_invoicing', 'approved_for_invoicing_at',
                             'pending_review', 'finance_notes', 'approved_by_name'];
  bad        text[];
BEGIN
  IF auth.uid() IS NULL OR current_user_role() = 'admin' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.invoiced
       OR NEW.approved_for_invoicing
       OR NEW.approved_for_invoicing_at IS NOT NULL
       OR NEW.pending_review
       OR NEW.finance_notes IS NOT NULL
       OR NEW.approved_by_name IS NOT NULL THEN
      RAISE EXCEPTION 'Only admins can set invoicing fields on a new extra job'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  bad := ARRAY(
    SELECT c FROM unnest(admin_cols) c
    WHERE (to_jsonb(NEW) -> c) IS DISTINCT FROM (to_jsonb(OLD) -> c)
  );
  IF cardinality(bad) > 0 THEN
    RAISE EXCEPTION 'Not allowed to change extra job field(s): %', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS extra_jobs_guard_columns ON extra_jobs;
CREATE TRIGGER extra_jobs_guard_columns
  BEFORE INSERT OR UPDATE ON extra_jobs
  FOR EACH ROW EXECUTE FUNCTION extra_jobs_guard_columns();


-- ── 4. stages: contract pricing admin only ───────────────────────────────────

CREATE OR REPLACE FUNCTION stages_guard_pricing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user_role() = 'admin' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_contract_pricing OR NEW.default_contract_price IS NOT NULL THEN
      RAISE EXCEPTION 'Only admins can set contract pricing on a stage'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.is_contract_pricing IS DISTINCT FROM OLD.is_contract_pricing
     OR NEW.default_contract_price IS DISTINCT FROM OLD.default_contract_price THEN
    RAISE EXCEPTION 'Only admins can change contract pricing on a stage'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stages_guard_pricing ON stages;
CREATE TRIGGER stages_guard_pricing
  BEFORE INSERT OR UPDATE ON stages
  FOR EACH ROW EXECUTE FUNCTION stages_guard_pricing();


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
