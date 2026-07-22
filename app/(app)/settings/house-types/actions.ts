'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { MutationState } from '@/types/actions'

async function requireAdmin(): Promise<MutationState | null> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required.' }
  return null
}

const SIZES = ['S', 'M', 'L']

function parseArea(formData: FormData, key: string): { value: number | null; error: string | null } {
  const raw = (formData.get(key) as string)?.trim()
  if (!raw) return { value: null, error: null }
  const n = Number(raw)
  if (isNaN(n) || n < 0) return { value: null, error: `Invalid ${key.replace(/_/g, ' ')}.` }
  return { value: n, error: null }
}

function parseFields(formData: FormData) {
  const developer = (formData.get('developer') as string)?.trim() || 'Providence'
  const name       = (formData.get('name') as string)?.trim()
  const size       = formData.get('size') as string

  const siteArea      = parseArea(formData, 'site_area')
  const turfArea       = parseArea(formData, 'turf_area')
  const softworksArea  = parseArea(formData, 'softworks_area')
  const alfrescoArea   = parseArea(formData, 'alfresco_area')

  const error =
    (!name ? 'Design name is required.' : null) ??
    (!SIZES.includes(size) ? 'Size must be S, M, or L.' : null) ??
    siteArea.error ?? turfArea.error ?? softworksArea.error ?? alfrescoArea.error

  return {
    error,
    fields: {
      developer, name, size,
      site_area: siteArea.value,
      turf_area: turfArea.value,
      softworks_area: softworksArea.value,
      alfresco_area: alfrescoArea.value,
    },
  }
}

export async function createHouseType(
  _prev: MutationState,
  formData: FormData
): Promise<MutationState> {
  const err = await requireAdmin(); if (err) return err

  const { error, fields } = parseFields(formData)
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('house_types').insert(fields)
  if (dbError) return { error: dbError.message }

  revalidatePath('/settings/house-types')
  revalidateTag('house-types')
  return { success: 'House type added.' }
}

export async function updateHouseType(
  _prev: MutationState,
  formData: FormData
): Promise<MutationState> {
  const err = await requireAdmin(); if (err) return err

  const id = formData.get('id') as string
  if (!id) return { error: 'House type ID is missing.' }

  const { error, fields } = parseFields(formData)
  if (error) return { error }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('house_types').update(fields).eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidatePath('/settings/house-types')
  revalidateTag('house-types')
  return { success: 'Saved.' }
}

export async function deleteHouseType(
  _prev: MutationState,
  formData: FormData
): Promise<MutationState> {
  const err = await requireAdmin(); if (err) return err

  const id = formData.get('id') as string
  if (!id) return { error: 'House type ID is missing.' }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('house_types').delete().eq('id', id)
  if (dbError) return { error: dbError.message }

  revalidatePath('/settings/house-types')
  revalidateTag('house-types')
  return { success: 'House type removed.' }
}
