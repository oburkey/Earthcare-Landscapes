-- Refuse pending_review = true on a lot that is approved for invoicing.
--
-- The app already flags lots for review with a single UPDATE ... WHERE
-- approved_for_invoicing = false, but this also stops any other writer (an
-- old browser tab still running a previous deployment, the SQL editor, a
-- future code path) from leaving both Pending review and Approved ticked.
--
-- Only the change to true is refused. Rows already stuck with both flags on
-- can still be updated (and cleared) normally, and approving a lot that is
-- pending review is unaffected.

CREATE OR REPLACE FUNCTION lots_guard_pending_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pending_review
     AND NEW.approved_for_invoicing
     AND (TG_OP = 'INSERT' OR NOT OLD.pending_review) THEN
    RAISE EXCEPTION 'Lot is approved for invoicing. Un-approve it before flagging it for review.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lots_guard_pending_review ON lots;
CREATE TRIGGER lots_guard_pending_review
  BEFORE INSERT OR UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION lots_guard_pending_review();
