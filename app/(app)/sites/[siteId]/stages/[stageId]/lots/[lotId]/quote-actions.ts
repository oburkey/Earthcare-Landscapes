'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

export type QuoteItemPayload = {
  template_item_id: string
  item_name: string
  unit: string
  quantity: number | null
  unit_price_snapshot: number | null
}

export type SaveQuotePayload = {
  lotId: string
  siteId: string
  stageId: string
  isEstimated: boolean
  status: 'draft' | 'submitted'
  notes: string
  items: QuoteItemPayload[]
}

export async function saveLotQuote(payload: SaveQuotePayload): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role === 'worker' || profile.role === 'client') {
    return { error: 'You do not have permission to save quantity takeoffs.' }
  }

  const { lotId, siteId, stageId, isEstimated, status, notes, items } = payload
  const supabase = await createClient()

  // Find existing quote for this lot + type
  const { data: existing } = await supabase
    .from('lot_quotes')
    .select('id')
    .eq('lot_id', lotId)
    .eq('is_estimated', isEstimated)
    .maybeSingle()

  let quoteId: string

  if (existing) {
    const { error } = await supabase
      .from('lot_quotes')
      .update({
        status,
        notes: notes || null,
        quoted_by: profile.id,
        quoted_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    quoteId = existing.id
  } else {
    const { data, error } = await supabase
      .from('lot_quotes')
      .insert({
        lot_id: lotId,
        is_estimated: isEstimated,
        status,
        notes: notes || null,
        quoted_by: profile.id,
        quoted_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Failed to create quote.' }
    quoteId = data.id
  }

  // Replace all items (delete then insert)
  const { error: deleteError } = await supabase
    .from('lot_quote_items')
    .delete()
    .eq('quote_id', quoteId)
  if (deleteError) return { error: deleteError.message }

  const toInsert = items
    .filter((i) => i.quantity !== null)
    .map((i) => ({
      quote_id:           quoteId,
      template_item_id:   i.template_item_id,
      item_name:          i.item_name,
      unit:               i.unit,
      quantity:           i.quantity,
      unit_price_snapshot: i.unit_price_snapshot,
    }))

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('lot_quote_items')
      .insert(toInsert)
    if (insertError) return { error: insertError.message }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  return null
}
