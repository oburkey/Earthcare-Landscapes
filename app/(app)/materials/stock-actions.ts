'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logDbError(context: string, error: any) {
  console.error(`[materials/stock-actions] ${context}:`, {
    message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
  })
}

// Manual inline edit of an existing site_stock_items row (leading_hand+).
// Uses the regular session client — RLS already permits this role directly,
// no admin-client bypass needed here (unlike the automatic quant-deduction
// and order-delivery writes, which go through applyStockDelta).
export async function updateSiteStockItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only leading hands and above can update stock.' }
  }

  try {
    const siteId         = formData.get('site_id') as string
    const materialTypeId = formData.get('material_type_id') as string
    const valueRaw        = formData.get('value') as string

    if (!siteId) return { error: 'Site is required.' }
    if (!materialTypeId) return { error: 'Material is required.' }

    const value = parseFloat(valueRaw)
    if (isNaN(value) || value < 0) return { error: 'Enter a valid, non-negative number.' }

    const supabase = await createClient()
    const { error } = await supabase
      .from('site_stock_items')
      .upsert(
        {
          site_id: siteId,
          material_type_id: materialTypeId,
          quantity: value,
          last_updated_by: profile.id,
          last_update_source: 'manual',
          last_update_lot: null,
        },
        { onConflict: 'site_id,material_type_id' }
      )

    if (error) { logDbError('updateSiteStockItem upsert', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/stock-actions] updateSiteStockItem unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while updating stock.' }
  }
}

// Adds a new material to a site's stock list (admin only — per spec, this is
// stricter than the leading_hand+ RLS insert policy, enforced at the app
// level here).
export async function addSiteStockItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can add new stock items.' }

  try {
    const siteId         = formData.get('site_id') as string
    const materialTypeId = formData.get('material_type_id') as string
    const initialRaw      = ((formData.get('initial_quantity') as string) ?? '').trim()
    const initialQuantity = initialRaw ? parseFloat(initialRaw) : 0

    if (!siteId) return { error: 'Site is required.' }
    if (!materialTypeId) return { error: 'Material is required.' }
    if (isNaN(initialQuantity) || initialQuantity < 0) return { error: 'Enter a valid, non-negative starting quantity.' }

    const supabase = await createClient()
    const { error } = await supabase
      .from('site_stock_items')
      .insert({
        site_id: siteId,
        material_type_id: materialTypeId,
        quantity: initialQuantity,
        last_updated_by: profile.id,
        last_update_source: 'manual',
      })

    if (error) {
      logDbError('addSiteStockItem insert', error)
      return { error: error.code === '23505' ? 'This material has already been added to this site.' : error.message }
    }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/stock-actions] addSiteStockItem unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while adding the stock item.' }
  }
}
