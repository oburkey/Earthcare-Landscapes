'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

export const STOCK_FIELDS = [
  'plants_140mm', 'plants_200mm', 'mulch_tonnes', 'edging_metres', 'turf_rolls', 'drippers_packs',
] as const
export type StockField = typeof STOCK_FIELDS[number]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logDbError(context: string, error: any) {
  console.error(`[materials/stock-actions] ${context}:`, {
    message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
  })
}

export async function updateSiteStock(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only leading hands and above can update stock.' }
  }

  const siteId = formData.get('site_id') as string
  const field  = formData.get('field') as string
  const valueRaw = formData.get('value') as string

  if (!siteId) return { error: 'Site is required.' }
  if (!STOCK_FIELDS.includes(field as StockField)) return { error: 'Invalid stock field.' }

  const value = parseFloat(valueRaw)
  if (isNaN(value) || value < 0) return { error: 'Enter a valid, non-negative number.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_stock')
    .upsert(
      { site_id: siteId, [field]: value, last_updated_by: profile.id },
      { onConflict: 'site_id' }
    )

  if (error) { logDbError('updateSiteStock upsert site_stock', error); return { error: error.message } }

  revalidatePath('/materials')
  return null
}
