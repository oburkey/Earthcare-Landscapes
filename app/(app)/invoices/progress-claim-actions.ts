'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

export async function createProgressClaim(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const stageId     = formData.get('stage_id') as string
  const percentage  = formData.get('percentage') as string
  const claimAmount = parseFloat(formData.get('claim_amount') as string)
  const notes       = (formData.get('notes') as string)?.trim() || null

  if (isNaN(claimAmount) || claimAmount <= 0) return { error: 'A valid claim amount is required.' }

  const supabase = await createClient()

  // Auto-increment claim_number per stage
  const { data: existing } = await supabase
    .from('progress_claims')
    .select('claim_number')
    .eq('stage_id', stageId)
    .order('claim_number', { ascending: false })
    .limit(1)

  const nextNumber = existing && existing.length > 0 ? existing[0].claim_number + 1 : 1

  const { error } = await supabase.from('progress_claims').insert({
    stage_id:     stageId,
    claim_number: nextNumber,
    percentage:   percentage ? parseFloat(percentage) : null,
    claim_amount: claimAmount,
    notes,
    created_by:   profile.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function toggleProgressClaimPendingReview(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const id    = formData.get('id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('progress_claims')
    .update({ pending_review: value })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function toggleProgressClaimApprovedForInvoicing(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const id    = formData.get('id') as string
  const value = formData.get('value') === 'true'

  const update: Record<string, boolean> = { approved_for_invoicing: value }
  if (value) update.pending_review = false

  const supabase = await createClient()
  const { error } = await supabase
    .from('progress_claims')
    .update(update)
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function toggleProgressClaimInvoiced(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const id    = formData.get('id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('progress_claims')
    .update({ invoiced: value })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}

export async function deleteProgressClaim(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const id = formData.get('id') as string

  const supabase = await createClient()
  const { error } = await supabase.from('progress_claims').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}
