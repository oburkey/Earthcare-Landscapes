-- Leading hands get edit access to vehicle details (previously view-only via
-- the "vehicles: all staff can read" policy). Add/remove and full access
-- stay supervisor/admin-only via the existing "vehicles: supervisors and
-- admins full access" policy — this only adds UPDATE for leading_hand.
-- RLS policies are permissive (OR'd together), so this is additive.

DROP POLICY IF EXISTS "vehicles: leading_hand can update" ON vehicles;
CREATE POLICY "vehicles: leading_hand can update"
  ON vehicles FOR UPDATE
  USING (current_user_role() = 'leading_hand')
  WITH CHECK (current_user_role() = 'leading_hand');
