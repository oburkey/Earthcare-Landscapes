'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
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

  // When saving an estimate, auto-copy fine grading values to the final quote
  // if the final quote doesn't already have that item entered.
  if (isEstimated) {
    const fineGradingItems = items.filter(
      (i) => i.quantity != null && i.item_name.toLowerCase().includes('fine grading')
    )
    if (fineGradingItems.length > 0) {
      const { data: finalQuote } = await supabase
        .from('lot_quotes')
        .select('id, lot_quote_items(template_item_id, quantity)')
        .eq('lot_id', lotId)
        .eq('is_estimated', false)
        .maybeSingle()

      if (finalQuote) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingIds = new Set(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((finalQuote.lot_quote_items as any[]) ?? [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter((qi: any) => qi.quantity != null)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((qi: any) => qi.template_item_id)
        )
        const toCarry = fineGradingItems.filter((i) => !existingIds.has(i.template_item_id))
        if (toCarry.length > 0) {
          await supabase.from('lot_quote_items').insert(
            toCarry.map((i) => ({
              quote_id:            finalQuote.id,
              template_item_id:    i.template_item_id,
              item_name:           i.item_name,
              unit:                i.unit,
              quantity:            i.quantity,
              unit_price_snapshot: i.unit_price_snapshot,
            }))
          )
        }
      }
    }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidateTag('stages')
  return null
}
