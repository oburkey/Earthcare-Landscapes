'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { MutationState } from '@/types/actions'

async function requireAdmin(): Promise<MutationState | null> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required.' }
  return null
}

type SavedItem = {
  description: string
  qty: number
  unit: string
  rate: number
  orderIndex: number
}

type SavedSection = {
  name: string
  orderIndex: number
  items: SavedItem[]
}

export async function createTemplate(
  formData: FormData
): Promise<{ error: string } | { id: string }> {
  const err = await requireAdmin()
  if (err) return { error: err.error! }

  const name = ((formData.get('name') as string) ?? '').trim()
  const description = ((formData.get('description') as string) ?? '').trim() || null
  if (!name) return { error: 'Template name is required.' }

  const supabase = await createClient()

  const { data: maxRow } = await supabase
    .from('quote_presets')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle()
  const orderIndex = (maxRow?.order_index ?? -1) + 1

  const { data, error } = await supabase
    .from('quote_presets')
    .insert({ name, description, order_index: orderIndex })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to create template.' }

  revalidatePath('/settings/quote-templates')
  return { id: data.id }
}

export async function deleteTemplate(formData: FormData): Promise<MutationState> {
  const err = await requireAdmin(); if (err) return err

  const id = formData.get('id') as string
  if (!id) return { error: 'Template ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase.from('quote_presets').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/settings/quote-templates')
  revalidatePath('/quotes')
  return { success: 'Template deleted.' }
}

// Replaces all of a template's sections + items with the given set — same
// delete-then-reinsert pattern used for quote_sections in
// app/(app)/quotes/actions.ts's replaceSections.
export async function saveTemplate(formData: FormData): Promise<MutationState> {
  const err = await requireAdmin(); if (err) return err

  const id          = formData.get('id') as string
  const name        = ((formData.get('name') as string) ?? '').trim()
  const description = ((formData.get('description') as string) ?? '').trim() || null
  const rawSections = formData.get('sections') as string

  if (!id) return { error: 'Template ID is missing.' }
  if (!name) return { error: 'Template name is required.' }

  let sections: SavedSection[]
  try {
    sections = JSON.parse(rawSections || '[]')
  } catch {
    return { error: 'Invalid section data.' }
  }

  const supabase = await createClient()

  const { error: metaError } = await supabase
    .from('quote_presets')
    .update({ name, description })
    .eq('id', id)
  if (metaError) return { error: metaError.message }

  const { error: deleteError } = await supabase
    .from('quote_preset_sections')
    .delete()
    .eq('preset_id', id)
  if (deleteError) return { error: deleteError.message }

  for (const section of sections) {
    const { data: sectionRow, error: sectionError } = await supabase
      .from('quote_preset_sections')
      .insert({ preset_id: id, name: section.name, order_index: section.orderIndex })
      .select('id')
      .single()
    if (sectionError || !sectionRow) return { error: sectionError?.message ?? 'Failed to save section.' }

    if (section.items.length > 0) {
      const { error: itemsError } = await supabase
        .from('quote_preset_items')
        .insert(
          section.items.map((item) => ({
            section_id:  sectionRow.id,
            description: item.description,
            qty:         item.qty,
            unit:        item.unit,
            rate:        item.rate,
            order_index: item.orderIndex,
          }))
        )
      if (itemsError) return { error: itemsError.message }
    }
  }

  revalidatePath('/settings/quote-templates')
  revalidatePath('/quotes')
  return { success: 'Template saved.' }
}
