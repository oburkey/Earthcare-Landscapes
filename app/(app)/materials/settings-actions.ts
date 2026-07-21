'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

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

  const parsed = parseConversionForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()

  const { data: maxRow } = await supabase
    .from('material_conversion_settings')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextIndex = (maxRow?.order_index ?? 0) + 1

  const { error } = await supabase
    .from('material_conversion_settings')
    .insert({ ...parsed.values, order_index: nextIndex })

  if (error) return { error: error.message }

  revalidatePath('/materials')
  return null
}

export async function updateConversionSetting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can manage conversion rates.' }

  const id = formData.get('id') as string
  if (!id) return { error: 'Setting ID is missing.' }

  const parsed = parseConversionForm(formData)
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('material_conversion_settings')
    .update(parsed.values)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/materials')
  return null
}

export async function deleteConversionSetting(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can manage conversion rates.' }

  const id = formData.get('id') as string
  if (!id) return { error: 'Setting ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase.from('material_conversion_settings').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/materials')
  return null
}
