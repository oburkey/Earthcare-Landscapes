'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logDbError(context: string, error: any) {
  console.error(`[materials/settings-actions] ${context}:`, {
    message: error?.message, code: error?.code, details: error?.details, hint: error?.hint,
  })
}

type ConversionValues = {
  name: string
  unit_from: string
  unit_to: string
  conversion_rate: number
  wastage_pct: number
  notes: string | null
}

type ParsedConversion =
  | { ok: false; error: string }
  | { ok: true; values: ConversionValues }

function parseConversionForm(formData: FormData): ParsedConversion {
  const name           = ((formData.get('name') as string) ?? '').trim()
  const unitFrom        = ((formData.get('unit_from') as string) ?? '').trim()
  const unitTo          = ((formData.get('unit_to') as string) ?? '').trim()
  const conversionRate = parseFloat((formData.get('conversion_rate') as string) ?? '')
  const wastagePctRaw   = ((formData.get('wastage_pct') as string) ?? '').trim()
  const wastagePct      = wastagePctRaw ? parseFloat(wastagePctRaw) : 0
  const notes           = ((formData.get('notes') as string) ?? '').trim() || null

  if (!name)       return { ok: false, error: 'Name is required.' }
  if (!unitFrom)   return { ok: false, error: 'Converts-from unit is required.' }
  if (!unitTo)     return { ok: false, error: 'Converts-to unit is required.' }
  if (isNaN(conversionRate) || conversionRate <= 0) return { ok: false, error: 'Enter a valid conversion rate.' }
  if (isNaN(wastagePct) || wastagePct < 0) return { ok: false, error: 'Enter a valid wastage percentage.' }

  return {
    ok: true,
    values: { name, unit_from: unitFrom, unit_to: unitTo, conversion_rate: conversionRate, wastage_pct: wastagePct, notes },
  }
}

export async function createConversionSetting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can manage conversion rates.' }

  try {
    const parsed = parseConversionForm(formData)
    if (!parsed.ok) return { error: parsed.error }

    const supabase = await createClient()

    const { data: maxRow, error: maxRowError } = await supabase
      .from('material_conversion_settings')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (maxRowError) logDbError('createConversionSetting fetch max order_index', maxRowError)
    const nextIndex = (maxRow?.order_index ?? 0) + 1

    const { error } = await supabase
      .from('material_conversion_settings')
      .insert({ ...parsed.values, order_index: nextIndex })

    if (error) { logDbError('createConversionSetting insert', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/settings-actions] createConversionSetting unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while creating the conversion rate.' }
  }
}

export async function updateConversionSetting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can manage conversion rates.' }

  try {
    const id = formData.get('id') as string
    if (!id) return { error: 'Setting ID is missing.' }

    const parsed = parseConversionForm(formData)
    if (!parsed.ok) return { error: parsed.error }

    const supabase = await createClient()
    const { error } = await supabase
      .from('material_conversion_settings')
      .update(parsed.values)
      .eq('id', id)

    if (error) { logDbError('updateConversionSetting update', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/settings-actions] updateConversionSetting unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while updating the conversion rate.' }
  }
}

export async function deleteConversionSetting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can manage conversion rates.' }

  try {
    const id = formData.get('id') as string
    if (!id) return { error: 'Setting ID is missing.' }

    const supabase = await createClient()
    const { error } = await supabase.from('material_conversion_settings').delete().eq('id', id)
    if (error) { logDbError('deleteConversionSetting delete', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/settings-actions] deleteConversionSetting unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while deleting the conversion rate.' }
  }
}
