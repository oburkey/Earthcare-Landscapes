'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { STOCK_GROUPS } from './stock-constants'
import type { ActionState } from '@/types/actions'

async function requireAdmin(): Promise<ActionState | null> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required.' }
  return null
}

// Comma-separated free text -> trimmed, non-empty string array.
function parseQuantItemNames(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export async function createMaterialType(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const err = await requireAdmin(); if (err) return err

  const name       = (formData.get('name') as string)?.trim()
  const unit       = (formData.get('unit') as string)?.trim()
  const stockGroup = formData.get('stock_group') as string
  const quantItemNames = parseQuantItemNames(formData.get('quant_item_names') as string)

  if (!name) return { error: 'Name is required.' }
  if (!unit) return { error: 'Unit is required.' }
  if (!(STOCK_GROUPS as readonly string[]).includes(stockGroup)) return { error: 'Invalid stock group.' }

  const supabase = await createClient()

  const { data: last } = await supabase
    .from('material_types')
    .select('order_index')
    .eq('stock_group', stockGroup)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextOrder = (last?.[0]?.order_index ?? -1) + 1

  const { error } = await supabase
    .from('material_types')
    .insert({ name, unit, stock_group: stockGroup, quant_item_names: quantItemNames, order_index: nextOrder })

  if (error) return { error: error.message }
  revalidatePath('/materials')
  return null
}

export async function updateMaterialType(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const err = await requireAdmin(); if (err) return err

  const id   = formData.get('material_type_id') as string
  const name = (formData.get('name') as string)?.trim()
  const unit = (formData.get('unit') as string)?.trim()
  const quantItemNames = parseQuantItemNames(formData.get('quant_item_names') as string)

  if (!id) return { error: 'Material ID is missing.' }
  if (!name) return { error: 'Name is required.' }
  if (!unit) return { error: 'Unit is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('material_types')
    .update({ name, unit, quant_item_names: quantItemNames })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/materials')
  return null
}

export async function toggleMaterialTypeActive(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return

  const id       = formData.get('material_type_id') as string
  const isActive = formData.get('is_active') === 'true'

  const supabase = await createClient()
  await supabase
    .from('material_types')
    .update({ is_active: !isActive })
    .eq('id', id)

  revalidatePath('/materials')
}

export async function moveMaterialTypeUp(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return
  await swapMaterialTypeOrder(
    formData.get('material_type_id') as string,
    formData.get('stock_group') as string,
    'up'
  )
  revalidatePath('/materials')
}

export async function moveMaterialTypeDown(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return
  await swapMaterialTypeOrder(
    formData.get('material_type_id') as string,
    formData.get('stock_group') as string,
    'down'
  )
  revalidatePath('/materials')
}

async function swapMaterialTypeOrder(id: string, stockGroup: string, direction: 'up' | 'down') {
  const supabase = await createClient()
  const { data: all } = await supabase
    .from('material_types')
    .select('id, order_index')
    .eq('stock_group', stockGroup)
    .order('order_index', { ascending: true })

  if (!all) return
  const idx = all.findIndex((m) => m.id === id)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (idx === -1 || swapIdx < 0 || swapIdx >= all.length) return

  const a = all[idx], b = all[swapIdx]
  await supabase.from('material_types').update({ order_index: b.order_index }).eq('id', a.id)
  await supabase.from('material_types').update({ order_index: a.order_index }).eq('id', b.id)
}
