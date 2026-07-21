'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

export async function toggleInvoiced(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Invoiced.' }

  const lotId = formData.get('lot_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('lots')
    .update({ invoiced: value })
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function togglePendingReview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Pending Review.' }

  const lotId = formData.get('lot_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('lots')
    .update({ pending_review: value })
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function toggleApprovedForInvoicing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Approved for Invoicing.' }

  const lotId = formData.get('lot_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  // Approving also clears pending_review
  const update: Record<string, boolean> = { approved_for_invoicing: value }
  if (value) update.pending_review = false

  const { error } = await supabase
    .from('lots')
    .update(update)
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function markAsInvoiced(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can create invoice runs.' }

  const lotIdsRaw          = formData.get('lot_ids')           as string
  const extraJobIdsRaw     = formData.get('extra_job_ids')      as string
  const progressClaimIdsRaw = formData.get('progress_claim_ids') as string
  const totalAmountRaw     = formData.get('total_amount')       as string
  const notes              = (formData.get('notes') as string)?.trim() || null
  const invoiceDate        = (formData.get('invoice_date') as string) || new Date().toISOString()

  const lotIds           = lotIdsRaw           ? lotIdsRaw.split(',').filter(Boolean)           : []
  const extraJobIds      = extraJobIdsRaw      ? extraJobIdsRaw.split(',').filter(Boolean)      : []
  const progressClaimIds = progressClaimIdsRaw ? progressClaimIdsRaw.split(',').filter(Boolean) : []
  const totalAmount      = totalAmountRaw ? parseFloat(totalAmountRaw) || null : null

  if (lotIds.length === 0 && extraJobIds.length === 0 && progressClaimIds.length === 0) {
    return { error: 'Nothing selected.' }
  }

  const supabase   = await createClient()
  const invoicedAt = invoiceDate

  const { data: runData, error: runError } = await supabase
    .from('invoice_runs')
    .insert({
      invoiced_by:        profile.id,
      invoiced_at:        invoicedAt,
      lot_ids:            lotIds,
      extra_job_ids:      extraJobIds,
      progress_claim_ids: progressClaimIds,
      total_amount:       totalAmount,
      notes,
    })
    .select('id')
    .single()
  if (runError) return { error: runError.message }

  if (lotIds.length > 0) {
    const { error } = await supabase
      .from('lots')
      .update({ invoiced: true, approved_for_invoicing: false })
      .in('id', lotIds)
    if (error) return { error: error.message }
  }

  if (progressClaimIds.length > 0) {
    const { error } = await supabase
      .from('progress_claims')
      .update({ invoiced: true, approved_for_invoicing: false, invoice_run_id: runData.id, invoiced_at: invoicedAt })
      .in('id', progressClaimIds)
    if (error) return { error: error.message }
  }

  revalidatePath('/invoices')
  return null
}

// Reverses an invoice run: unmarks its lots/progress claims as invoiced and
// returns them to approved status, then deletes the run itself. Extra jobs
// need no column update — their invoiced status is derived from membership in
// invoice_runs.extra_job_ids, so deleting the run un-invoices them automatically.
export async function deleteInvoiceRun(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete invoice runs.' }

  const runId = formData.get('run_id') as string
  if (!runId) return { error: 'Invoice run ID is missing.' }

  const supabase = await createClient()

  const { data: run, error: fetchError } = await supabase
    .from('invoice_runs')
    .select('lot_ids, progress_claim_ids')
    .eq('id', runId)
    .single()
  if (fetchError || !run) return { error: fetchError?.message ?? 'Invoice run not found.' }

  const lotIds = (run.lot_ids ?? []) as string[]
  const progressClaimIds = (run.progress_claim_ids ?? []) as string[]

  if (lotIds.length > 0) {
    const { error } = await supabase
      .from('lots')
      .update({ invoiced: false, approved_for_invoicing: true })
      .in('id', lotIds)
    if (error) return { error: error.message }
  }

  if (progressClaimIds.length > 0) {
    const { error } = await supabase
      .from('progress_claims')
      .update({ invoiced: false, approved_for_invoicing: true, invoice_run_id: null })
      .in('id', progressClaimIds)
    if (error) return { error: error.message }
  }

  const { error: deleteError } = await supabase
    .from('invoice_runs')
    .delete()
    .eq('id', runId)
  if (deleteError) return { error: deleteError.message }

  revalidatePath('/invoices')
  return null
}
