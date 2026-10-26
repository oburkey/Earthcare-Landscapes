-- =============================================================================
-- Earthcare Landscapes — Migration: RLS hardening (invitations, profiles,
-- duplicate policies)
--
-- 1. invitations: drop "read by token (unauthenticated)" (qual = true let
--    anyone with the public key list every invite, token included) and add
--    get_invitation_by_token() for the /invite page instead.
-- 2. invitations: drop "supervisors create" — supervisors could insert an
--    invite with role = 'admin'. Admin insert is still covered by
--    "invitations: admin full access". (createInvite is admin-only in app.)
-- 3. profiles: trigger so non-admins can only change first_name, last_name
--    and phone_number on their own row — "profiles: update own" previously
--    let any user set their own role.
-- 4. invoice_runs: replace the EXISTS(profiles …) policy and the separate
--    delete policy with one current_user_role() policy.
-- 5. quotes: drop the EXISTS(profiles …) duplicate, keep the
--    current_user_role() policy.
--
-- Server-side writes using the service-role client (auth.uid() IS NULL)
-- and the SQL editor are not affected by the profiles trigger.
--
-- Run in Supabase SQL Editor → New query. Run this BEFORE deploying the app
-- change to app/(auth)/invite/page.tsx (it calls get_invitation_by_token).
-- Safe to run multiple times.
-- =============================================================================


-- ── Shared helper: which columns changed outside an allowed list ────────────
-- Returns NULL when nothing outside `allowed` changed. Compares whole rows as
-- jsonb so columns added later are protected automatically.
CREATE OR REPLACE FUNCTION changed_columns(old_row jsonb, new_row jsonb, allowed text[])
RETURNS text[]
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT array_agg(n.key ORDER BY n.key)
  FROM jsonb_each(new_row) n
  WHERE NOT (n.key = ANY (allowed))
    AND n.value IS DISTINCT FROM (old_row -> n.key);
$$;


-- ── 1. invitations: token lookup function replaces "read by token" ─────────

DROP POLICY IF EXISTS "invitations: read by token (unauthenticated)" ON invitations;

-- One pending (not yet accepted) invite for the given token, with only the
-- fields the invite page shows. Expiry is still checked by the page and by
-- acceptInvite. The token is compared as text so a malformed token returns
-- no rows instead of a uuid cast error.
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token text)
RETURNS TABLE (
  email      text,
  role       text,
  profile_id uuid,
  sent_at    timestamptz,
  created_at timestamptz,
  first_name text,
  last_name  text
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.email::text,
    i.role::text,
    i.profile_id,
    i.sent_at::timestamptz,
    i.created_at,
    p.first_name::text,
    p.last_name::text
  FROM invitations i
  LEFT JOIN profiles p ON p.id = i.profile_id
  WHERE i.token::text = p_token
    AND i.accepted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL     ON FUNCTION get_invitation_by_token(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_invitation_by_token(text) TO anon, authenticated;


-- ── 2. invitations: supervisors can no longer create invites ────────────────

DROP POLICY IF EXISTS "invitations: supervisors create" ON invitations;


-- ── 3. profiles: non-admins can only change their name and phone ───────────

CREATE OR REPLACE FUNCTION profiles_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  bad text[];
BEGIN
  -- Service-role client / SQL editor (no signed-in user), or an admin
  IF auth.uid() IS NULL OR current_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  bad := changed_columns(to_jsonb(OLD), to_jsonb(NEW), ARRAY['first_name', 'last_name', 'phone_number']);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Not allowed to change profile field(s): %', array_to_string(bad, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_columns ON profiles;
CREATE TRIGGER profiles_guard_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_guard_columns();


-- ── 4. invoice_runs: one current_user_role() policy ─────────────────────────

DROP POLICY IF EXISTS "Admins can manage invoice runs" ON invoice_runs;
DROP POLICY IF EXISTS "invoice_runs: admin delete"     ON invoice_runs;
DROP POLICY IF EXISTS "invoice_runs: admin full access" ON invoice_runs;

CREATE POLICY "invoice_runs: admin full access"
  ON invoice_runs FOR ALL
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');


-- ── 5. quotes: drop the EXISTS(profiles …) duplicate ────────────────────────
-- "quotes: supervisor+ full access" (current_user_role(), same roles) stays.

DROP POLICY IF EXISTS "Supervisors and admins can manage quotes" ON quotes;


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
