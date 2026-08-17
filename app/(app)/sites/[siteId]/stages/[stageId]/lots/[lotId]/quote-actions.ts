'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getActiveMaterialTypes, computeQuantSheetStockChanges, applyStockDelta } from '@/app/(app)/materials/stock-deduction'
import type { ActionState } from '@/types/actions'

export type QuoteItemPayload = {
  template_item_id: string
  item_name: string
  unit: string
  quantity: number | null
  unit_price_snapshot: number | null
}

export type QuoteType = 'estimate' | 'budget' | 'final'

export type SaveQuotePayload = {
  lotId: string
  siteId: string
  stageId: string
  quoteType: QuoteType
  status: 'draft' | 'submitted'
  notes: string
  items: QuoteItemPayload[]
}

export async function saveLotQuote(payload: SaveQuotePayload): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role === 'worker' || profile.role === 'client') {
    return { error: 'You do not have permission to save quantity takeoffs.' }
  }

  const { lotId, siteId, stageId, quoteType, status, notes, items } = payload

  // Estimate is admin-only — RLS already enforces this at the DB layer, this
  // is just a clearer error than the raw RLS failure would give.
  if (quoteType === 'estimate' && profile.role !== 'admin') {
    return { error: 'Only admins can edit the estimate quant sheet.' }
  }

  const supabase = await createClient()
  // is_estimated is kept in sync alongside quote_type for now (not dropped —
  // see supabase/migration_budget_quant_sheet.sql), true only for 'estimate'.
  const isEstimated = quoteType === 'estimate'

  // Find existing quote for this lot + type
  const { data: existing } = await supabase
    .from('lot_quotes')
    .select('id')
    .eq('lot_id', lotId)
    .eq('quote_type', quoteType)
    .maybeSingle()

  let quoteId: string

  const now = new Date().toISOString()

  if (existing) {
    const { error } = await supabase
      .from('lot_quotes')
      .update({
        status,
        notes: notes || null,
        quoted_by: profile.id,
        quoted_at: now,
        last_edited_by: profile.id,
        last_edited_at: now,
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    quoteId = existing.id
  } else {
    const { data, error } = await supabase
      .from('lot_quotes')
      .insert({
        lot_id: lotId,
        quote_type: quoteType,
        is_estimated: isEstimated,
        status,
        notes: notes || null,
        quoted_by: profile.id,
        quoted_at: now,
        last_edited_by: profile.id,
        last_edited_at: now,
      })
      .select('id')
      .single()
    if (error || !data) return { error: error?.message ?? 'Failed to create quote.' }
    quoteId = data.id
  }

  // For a final quant sheet, snapshot the current (about-to-be-replaced)
  // items first — this is the "old" side of the stock-deduction diff below,
  // and must be captured before the delete wipes it. Budget is excluded —
  // it doesn't drive stock deduction (see below).
  let oldItemsSnapshot: { item_name: string; quantity: number | null }[] = []
  if (quoteType === 'final') {
    const { data } = await supabase
      .from('lot_quote_items')
      .select('item_name, quantity')
      .eq('quote_id', quoteId)
    oldItemsSnapshot = data ?? []
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
  if (quoteType === 'estimate') {
    const fineGradingItems = items.filter(
      (i) => i.quantity != null && i.item_name.toLowerCase().includes('fine grading')
    )
    if (fineGradingItems.length > 0) {
      const { data: finalQuote } = await supabase
        .from('lot_quotes')
        .select('id, lot_quote_items(template_item_id, quantity)')
        .eq('lot_id', lotId)
        .eq('quote_type', 'final')
        .maybeSingle()

      if (finalQuote) {
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

  // Saving a final quant sheet flags the lot for admin review. Budget is
  // excluded — it's a tracking sheet, not a claim of completed work.
  if (quoteType === 'final') {
    const { error: pendingReviewError } = await supabase
      .from('lots')
      .update({ pending_review: true })
      .eq('id', lotId)
    if (pendingReviewError) return { error: pendingReviewError.message }
  }

  // Final quant sheet -> site stock deduction. Only deducts the DIFFERENCE
  // from the previous save (oldItemsSnapshot captured above), so re-saving
  // the same quant sheet repeatedly doesn't double-deduct. Never blocks the
  // quant sheet save itself — any failure here is logged and swallowed.
  // Budget is excluded — it's a tracking sheet, not actual material usage.
  if (quoteType === 'final') {
    try {
      const materialTypes = await getActiveMaterialTypes(supabase)
      const { data: newItems } = await supabase
        .from('lot_quote_items')
        .select('item_name, quantity')
        .eq('quote_id', quoteId)
      const stockChanges = computeQuantSheetStockChanges(materialTypes, oldItemsSnapshot, newItems ?? [])

      if (stockChanges.size > 0) {
        const { data: lotRow } = await supabase
          .from('lots')
          .select('lot_number')
          .eq('id', lotId)
          .single()

        for (const [materialTypeId, quantityChange] of stockChanges) {
          await applyStockDelta({
            siteId, materialTypeId, quantityChange,
            source: 'quant_deduction',
            updatedBy: profile.id,
            lotNumber: lotRow?.lot_number ?? null,
          })
        }
      }
    } catch (err) {
      console.error('[lots/quote-actions] saveLotQuote stock deduction failed (non-blocking):', err)
    }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath('/materials')
  revalidateTag('stages')
  return null
}
