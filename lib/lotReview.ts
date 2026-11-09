import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export const UNAPPROVE_FIRST = 'Un-approve first — this lot is approved for invoicing.'

// Flags a lot for admin review, but only while it is not approved for
// invoicing. The check is part of the same UPDATE (no separate read first),
// so a Final quant save can't read "not approved", lose a race with the
// Approve click, and then flag an approved lot. The database also refuses it
// (lots_guard_pending_review trigger).
//
// flagged = false with no error means the lot is approved and was left alone.
export async function flagLotForReview(
  supabase: Supabase,
  lotId: string,
  updatedBy: string
): Promise<{ flagged: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('lots')
    .update({ pending_review: true, updated_by: updatedBy })
    .eq('id', lotId)
    .eq('approved_for_invoicing', false)
    .select('id')
  if (error) return { flagged: false, error: error.message }
  if (data && data.length > 0) return { flagged: true }

  // Zero rows: the lot is approved (expected), or it can't be found / edited.
  // This read only decides which of the two to report.
  const { data: lot } = await supabase
    .from('lots')
    .select('approved_for_invoicing')
    .eq('id', lotId)
    .maybeSingle()
  if (lot?.approved_for_invoicing) return { flagged: false }
  return { flagged: false, error: 'Update failed — the lot could not be found or you do not have permission to edit it.' }
}
