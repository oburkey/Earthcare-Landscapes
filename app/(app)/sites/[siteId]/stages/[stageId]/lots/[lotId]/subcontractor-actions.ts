'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

function lotPath(siteId: string, stageId: string, lotId: string) {
  return `/sites/${siteId}/stages/${stageId}/lots/${lotId}`
}

export async function addSubcontractorCost(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const lotId         = formData.get('lot_id') as string
  const siteId        = formData.get('site_id') as string
  const stageId       = formData.get('stage_id') as string
  const trade         = (formData.get('trade') as string)?.trim()
  const tradeLabel    = (formData.get('trade_label') as string)?.trim() || null
  const invoiceAmount = parseFloat(formData.get('invoice_amount') as string)
  const invoiceDate   = (formData.get('invoice_date') as string) || null
  const notes         = (formData.get('notes') as string)?.trim() || null

  if (!trade) return { error: 'Trade is required.' }
  if (isNaN(invoiceAmount) || invoiceAmount <= 0) return { error: 'A valid invoice amount is required.' }
  if (trade === 'Other' && !tradeLabel) return { error: 'Please specify the trade label.' }

  const supabase = await createClient()
  const { error } = await supabase.from('subcontractor_costs').insert({
    lot_id:         lotId,
    trade,
    trade_label:    trade === 'Other' ? tradeLabel : null,
    invoice_amount: invoiceAmount,
    invoice_date:   invoiceDate,
    notes,
    created_by:     profile.id,
  })
  if (error) return { error: error.message }

  revalidatePath(lotPath(siteId, stageId, lotId))
  return null
}

export async function updateSubcontractorCost(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const id            = formData.get('id') as string
  const lotId         = formData.get('lot_id') as string
  const siteId        = formData.get('site_id') as string
  const stageId       = formData.get('stage_id') as string
  const trade         = (formData.get('trade') as string)?.trim()
  const tradeLabel    = (formData.get('trade_label') as string)?.trim() || null
  const invoiceAmount = parseFloat(formData.get('invoice_amount') as string)
  const invoiceDate   = (formData.get('invoice_date') as string) || null
  const notes         = (formData.get('notes') as string)?.trim() || null

  if (!trade) return { error: 'Trade is required.' }
  if (isNaN(invoiceAmount) || invoiceAmount <= 0) return { error: 'A valid invoice amount is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('subcontractor_costs').update({
    trade,
    trade_label:    trade === 'Other' ? tradeLabel : null,
    invoice_amount: invoiceAmount,
    invoice_date:   invoiceDate,
    notes,
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(lotPath(siteId, stageId, lotId))
  return null
}

export async function deleteSubcontractorCost(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const id      = formData.get('id') as string
  const lotId   = formData.get('lot_id') as string
  const siteId  = formData.get('site_id') as string
  const stageId = formData.get('stage_id') as string

  const supabase = await createClient()
  const { error } = await supabase.from('subcontractor_costs').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(lotPath(siteId, stageId, lotId))
  return null
}
