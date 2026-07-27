'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { STOCK_FIELDS } from './stock-constants'
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
  default_unit_price: number | null
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
  const defaultPriceRaw = ((formData.get('default_unit_price') as string) ?? '').trim()
  const defaultPrice    = defaultPriceRaw ? parseFloat(defaultPriceRaw) : null

  if (!name)       return { ok: false, error: 'Name is required.' }
  if (!unitFrom)   return { ok: false, error: 'Converts-from unit is required.' }
  if (!unitTo)     return { ok: false, error: 'Converts-to unit is required.' }
  if (isNaN(conversionRate) || conversionRate <= 0) return { ok: false, error: 'Enter a valid conversion rate.' }
  if (isNaN(wastagePct) || wastagePct < 0) return { ok: false, error: 'Enter a valid wastage percentage.' }
  if (defaultPrice != null && (isNaN(defaultPrice) || defaultPrice < 0)) {
    return { ok: false, error: 'Enter a valid default price.' }
  }

  return {
    ok: true,
    values: {
      name, unit_from: unitFrom, unit_to: unitTo, conversion_rate: conversionRate, wastage_pct: wastagePct, notes,
      default_unit_price: defaultPrice,
    },
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

// ── Linked materials (material_conversion_links) ─────────────────────────────

type LinkValues = {
  parent_setting_id: string
  name: string
  rate: number
  unit: string
  stock_field: string | null
}

type ParsedLink =
  | { ok: false; error: string }
  | { ok: true; values: LinkValues }

function parseConversionLinkForm(formData: FormData): ParsedLink {
  const parentSettingId = ((formData.get('parent_setting_id') as string) ?? '').trim()
  const name            = ((formData.get('name') as string) ?? '').trim()
  const unit            = ((formData.get('unit') as string) ?? '').trim()
  const rate            = parseFloat((formData.get('rate') as string) ?? '')
  const stockFieldRaw    = ((formData.get('stock_field') as string) ?? '').trim()
  const stockField      = stockFieldRaw || null

  if (!parentSettingId) return { ok: false, error: 'Parent conversion setting is missing.' }
  if (!name)            return { ok: false, error: 'Name is required.' }
  if (!unit)            return { ok: false, error: 'Unit is required.' }
  if (isNaN(rate) || rate <= 0) return { ok: false, error: 'Enter a valid rate.' }
  if (stockField && !(STOCK_FIELDS as readonly string[]).includes(stockField)) {
    return { ok: false, error: 'Invalid stock field.' }
  }

  return {
    ok: true,
    values: { parent_setting_id: parentSettingId, name, rate, unit, stock_field: stockField },
  }
}

export async function createConversionLink(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can manage conversion rates.' }

  try {
    const parsed = parseConversionLinkForm(formData)
    if (!parsed.ok) return { error: parsed.error }

    const supabase = await createClient()

    const { data: maxRow, error: maxRowError } = await supabase
      .from('material_conversion_links')
      .select('order_index')
      .eq('parent_setting_id', parsed.values.parent_setting_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (maxRowError) logDbError('createConversionLink fetch max order_index', maxRowError)
    const nextIndex = (maxRow?.order_index ?? 0) + 1

    const { error } = await supabase
      .from('material_conversion_links')
      .insert({ ...parsed.values, order_index: nextIndex })

    if (error) { logDbError('createConversionLink insert', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/settings-actions] createConversionLink unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while creating the linked material.' }
  }
}

export async function updateConversionLink(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can manage conversion rates.' }

  try {
    const id = formData.get('id') as string
    if (!id) return { error: 'Linked material ID is missing.' }

    const parsed = parseConversionLinkForm(formData)
    if (!parsed.ok) return { error: parsed.error }

    const supabase = await createClient()
    const { error } = await supabase
      .from('material_conversion_links')
      .update(parsed.values)
      .eq('id', id)

    if (error) { logDbError('updateConversionLink update', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/settings-actions] updateConversionLink unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while updating the linked material.' }
  }
}

export async function deleteConversionLink(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can manage conversion rates.' }

  try {
    const id = formData.get('id') as string
    if (!id) return { error: 'Linked material ID is missing.' }

    const supabase = await createClient()
    const { error } = await supabase.from('material_conversion_links').delete().eq('id', id)
    if (error) { logDbError('deleteConversionLink delete', error); return { error: error.message } }

    revalidatePath('/materials')
    return null
  } catch (err) {
    console.error('[materials/settings-actions] deleteConversionLink unexpected error:', err)
    return { error: err instanceof Error ? err.message : 'An unexpected error occurred while deleting the linked material.' }
  }
}
