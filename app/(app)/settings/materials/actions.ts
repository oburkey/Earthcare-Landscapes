'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { ActionState } from '@/types/actions'

async function requireAdmin(): Promise<ActionState | null> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required.' }
  return null
}

// ── Sections ──────────────────────────────────────────────────────────────────

export async function createSection(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const err = await requireAdmin(); if (err) return err

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Section name is required.' }

  const supabase = await createClient()
  const { data: last } = await supabase
    .from('quote_template_sections')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = (last?.[0]?.order_index ?? -1) + 1

  const { error } = await supabase
    .from('quote_template_sections')
    .insert({ name, order_index: nextOrder })

  if (error) return { error: error.message }
  revalidatePath('/settings/materials')
  revalidateTag('template')
  return null
}

export async function updateSectionName(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const err = await requireAdmin(); if (err) return err

  const id   = formData.get('section_id') as string
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Section name is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('quote_template_sections')
    .update({ name })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/settings/materials')
  revalidateTag('template')
  return null
}

export async function toggleSectionAdminOnly(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return

  const id       = formData.get('section_id') as string
  const current  = formData.get('admin_only') === 'true'

  const supabase = await createClient()
  await supabase
    .from('quote_template_sections')
    .update({ admin_only: !current })
    .eq('id', id)

  revalidatePath('/settings/materials')
  revalidateTag('template')
}

export async function toggleSectionActive(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return

  const id        = formData.get('section_id') as string
  const isActive  = formData.get('is_active') === 'true'

  const supabase = await createClient()
  await supabase
    .from('quote_template_sections')
    .update({ is_active: !isActive })
    .eq('id', id)

  revalidatePath('/settings/materials')
  revalidateTag('template')
}

export async function moveSectionUp(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return
  await swapSectionOrder(formData.get('section_id') as string, 'up')
  revalidatePath('/settings/materials')
  revalidateTag('template')
}

export async function moveSectionDown(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return
  await swapSectionOrder(formData.get('section_id') as string, 'down')
  revalidatePath('/settings/materials')
  revalidateTag('template')
}

async function swapSectionOrder(id: string, direction: 'up' | 'down') {
  const supabase = await createClient()
  const { data: all } = await supabase
    .from('quote_template_sections')
    .select('id, order_index')
    .order('order_index', { ascending: true })

  if (!all) return
  const idx = all.findIndex((s) => s.id === id)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return

  const a = all[idx], b = all[swapIdx]
  await supabase.from('quote_template_sections').update({ order_index: b.order_index }).eq('id', a.id)
  await supabase.from('quote_template_sections').update({ order_index: a.order_index }).eq('id', b.id)
}


// ── Items ─────────────────────────────────────────────────────────────────────

const ALLOWED_UNITS = ['No.', 'm²', 'm³', 'Lm', 'tonne', 'ITEM', 'toggle']

export async function createItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const err = await requireAdmin(); if (err) return err

  const section_id = formData.get('section_id') as string
  const name       = (formData.get('name') as string)?.trim()
  const unit       = formData.get('unit') as string

  if (!name) return { error: 'Item name is required.' }
  if (!ALLOWED_UNITS.includes(unit)) return { error: 'Invalid unit.' }

  const supabase = await createClient()
  const { data: last } = await supabase
    .from('quote_template_items')
    .select('order_index')
    .eq('section_id', section_id)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = (last?.[0]?.order_index ?? -1) + 1

  const { error } = await supabase
    .from('quote_template_items')
    .insert({ section_id, name, unit, order_index: nextOrder })

  if (error) return { error: error.message }
  revalidatePath('/settings/materials')
  revalidateTag('template')
  return null
}

export async function updateItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const err = await requireAdmin(); if (err) return err

  const id         = formData.get('item_id') as string
  const name       = (formData.get('name') as string)?.trim()
  const unit       = formData.get('unit') as string
  const priceRaw   = (formData.get('unit_price') as string)?.trim()

  if (!name) return { error: 'Item name is required.' }
  if (!ALLOWED_UNITS.includes(unit)) return { error: 'Invalid unit.' }

  const unit_price = priceRaw ? parseFloat(priceRaw) : null
  if (priceRaw && isNaN(unit_price!)) return { error: 'Invalid price.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('quote_template_items')
    .update({ name, unit, unit_price })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/settings/materials')
  revalidateTag('template')
  return null
}

export async function toggleItemActive(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return

  const id       = formData.get('item_id') as string
  const isActive = formData.get('is_active') === 'true'

  const supabase = await createClient()
  await supabase
    .from('quote_template_items')
    .update({ is_active: !isActive })
    .eq('id', id)

  revalidatePath('/settings/materials')
  revalidateTag('template')
}

export async function moveItemUp(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return
  await swapItemOrder(
    formData.get('item_id') as string,
    formData.get('section_id') as string,
    'up'
  )
  revalidatePath('/settings/materials')
  revalidateTag('template')
}

export async function moveItemDown(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return
  await swapItemOrder(
    formData.get('item_id') as string,
    formData.get('section_id') as string,
    'down'
  )
  revalidatePath('/settings/materials')
  revalidateTag('template')
}

async function swapItemOrder(id: string, sectionId: string, direction: 'up' | 'down') {
  const supabase = await createClient()
  const { data: all } = await supabase
    .from('quote_template_items')
    .select('id, order_index')
    .eq('section_id', sectionId)
    .order('order_index', { ascending: true })

  if (!all) return
  const idx = all.findIndex((i) => i.id === id)
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return

  const a = all[idx], b = all[swapIdx]
  await supabase.from('quote_template_items').update({ order_index: b.order_index }).eq('id', a.id)
  await supabase.from('quote_template_items').update({ order_index: a.order_index }).eq('id', b.id)
}
