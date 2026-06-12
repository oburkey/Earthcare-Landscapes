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

function parseRatios(formData: FormData): { front: number; rear: number } | { error: string } {
  const front = parseFloat(formData.get('front_ratio') as string)
  const rear = parseFloat(formData.get('rear_ratio') as string)
  if (isNaN(front) || front <= 0) return { error: 'Front ratio must be a positive number.' }
  if (isNaN(rear) || rear <= 0) return { error: 'Rear ratio must be a positive number.' }
  return { front, rear }
}

function parsePotSplit(formData: FormData): { split: Record<string, number> } | { error: string } {
  const small = parseFloat(formData.get('pot_small') as string)
  const large = parseFloat(formData.get('pot_large') as string)
  if (isNaN(small) || isNaN(large)) return { error: 'Pot size percentages are required.' }
  if (small < 0 || large < 0) return { error: 'Pot size percentages cannot be negative.' }
  if (Math.round((small + large) * 100) / 100 !== 100) return { error: 'Pot size percentages must sum to 100.' }
  return { split: { '130mm': small, '200mm': large } }
}

// ── Global default ───────────────────────────────────────────────────────────

export async function saveGlobalRatios(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const err = await requireAdmin(); if (err) return err
  const profile = await requireAuth()

  const ratios = parseRatios(formData)
  if ('error' in ratios) return { error: ratios.error }

  const potResult = parsePotSplit(formData)
  if ('error' in potResult) return { error: potResult.error }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('plant_ratio_settings')
    .select('id')
    .is('site_id', null)
    .maybeSingle()

  const payload = {
    front_ratio: ratios.front,
    rear_ratio: ratios.rear,
    pot_size_split: potResult.split,
    updated_by: profile.id,
  }

  const { error } = existing
    ? await supabase.from('plant_ratio_settings').update(payload).eq('id', existing.id)
    : await supabase.from('plant_ratio_settings').insert({ ...payload, site_id: null })

  if (error) return { error: error.message }
  revalidatePath('/settings/plant-ratios')
  revalidateTag('plant-ratios')
  return null
}

// ── Site overrides ────────────────────────────────────────────────────────────

export async function saveSiteOverride(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const err = await requireAdmin(); if (err) return err
  const profile = await requireAuth()

  const siteId = formData.get('site_id') as string
  if (!siteId) return { error: 'Site is required.' }

  const ratios = parseRatios(formData)
  if ('error' in ratios) return { error: ratios.error }

  const potResult = parsePotSplit(formData)
  if ('error' in potResult) return { error: potResult.error }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('plant_ratio_settings')
    .select('id')
    .eq('site_id', siteId)
    .maybeSingle()

  const payload = {
    front_ratio: ratios.front,
    rear_ratio: ratios.rear,
    pot_size_split: potResult.split,
    updated_by: profile.id,
  }

  const { error } = existing
    ? await supabase.from('plant_ratio_settings').update(payload).eq('id', existing.id)
    : await supabase.from('plant_ratio_settings').insert({ ...payload, site_id: siteId })

  if (error) return { error: error.message }
  revalidatePath('/settings/plant-ratios')
  revalidateTag('plant-ratios')
  return null
}

export async function deleteSiteOverride(formData: FormData): Promise<void> {
  const err = await requireAdmin(); if (err) return

  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('plant_ratio_settings').delete().eq('id', id)

  revalidatePath('/settings/plant-ratios')
  revalidateTag('plant-ratios')
}
