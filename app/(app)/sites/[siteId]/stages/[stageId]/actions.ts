'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

import type { ActionState, EditState, UploadActionState } from '@/types/actions'

export type BulkUpdateResult = {
  updated: number
  created: number
  errors:  string[]
}

export async function bulkUpdateLots(
  stageId: string,
  siteId:  string,
  rawData: string,
): Promise<BulkUpdateResult> {
  const profile = await requireAuth()
  if (
    profile.role !== 'leading_hand' &&
    profile.role !== 'supervisor' &&
    profile.role !== 'admin'
  ) {
    return { updated: 0, created: 0, errors: ['Insufficient permissions'] }
  }

  const lines = rawData.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { updated: 0, created: 0, errors: [] }

  const supabase = await createClient()

  const { data: existingLots } = await supabase
    .from('lots')
    .select('id, lot_number, status')
    .eq('stage_id', stageId)

  // Strip leading zeros for comparison so "019" matches "19", "030" matches "30"
  const stripZeros = (s: string) => s.replace(/^0+/, '') || '0'

  const lotsMap = new Map(
    (existingLots ?? []).map(l => [stripZeros(l.lot_number as string), l as { id: string; lot_number: string; status: string }])
  )

  const errors: string[] = []
  let updated = 0
  let created = 0

  for (const line of lines) {
    // Split on first tab or comma
    const sepIdx = line.search(/[\t,]/)
    if (sepIdx === -1) {
      errors.push(`"${line}": missing separator — expected tab or comma between lot number and date`)
      continue
    }
    const lotNumber = line.slice(0, sepIdx).trim()
    const dateStr   = line.slice(sepIdx + 1).trim()

    if (!lotNumber) {
      errors.push(`"${line}": missing lot number`)
      continue
    }

    // Parse DD/MM/YYYY
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!match) {
      errors.push(`Lot ${lotNumber}: invalid date "${dateStr}" — expected DD/MM/YYYY`)
      continue
    }
    const [, dd, mm, yyyy] = match
    const day   = parseInt(dd, 10)
    const month = parseInt(mm, 10)
    const year  = parseInt(yyyy, 10)
    const dt = new Date(year, month - 1, day)
    if (dt.getDate() !== day || dt.getMonth() !== month - 1 || dt.getFullYear() !== year) {
      errors.push(`Lot ${lotNumber}: "${dateStr}" is not a valid calendar date`)
      continue
    }
    const isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`

    const existing = lotsMap.get(stripZeros(lotNumber))
    if (existing) {
      const noDowngrade = existing.status === 'complete' || existing.status === 'in_progress'
      const newStatus   = noDowngrade ? existing.status : 'scheduled'
      const { error } = await supabase
        .from('lots')
        .update({ due_date: isoDate, status: newStatus })
        .eq('id', existing.id)
      if (error) {
        errors.push(`Lot ${lotNumber}: ${error.message}`)
      } else {
        updated++
        lotsMap.set(stripZeros(lotNumber), { ...existing, status: newStatus })
      }
    } else {
      const { data: newLot, error } = await supabase
        .from('lots')
        .insert({ stage_id: stageId, lot_number: lotNumber, due_date: isoDate, status: 'scheduled' })
        .select('id, lot_number, status')
        .single()
      if (error) {
        errors.push(`Lot ${lotNumber} (create): ${error.message}`)
      } else {
        created++
        lotsMap.set(stripZeros(newLot.lot_number), newLot)
      }
    }
  }

  if (updated > 0 || created > 0) {
    revalidatePath(`/sites/${siteId}/stages/${stageId}`)
    revalidateTag('stages')
    revalidateTag('dashboard')
    revalidateTag('schedule')
  }

  return { updated, created, errors }
}

export async function deleteStage(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete stages.' }

  const siteId  = formData.get('site_id') as string
  const stageId = formData.get('stage_id') as string
  const supabase = await createClient()

  const { data: stage } = await supabase
    .from('stages')
    .select('site_plan_path')
    .eq('id', stageId)
    .single()

  if (stage?.site_plan_path) {
    await deleteFromR2(stage.site_plan_path).catch(() => null)
  }

  const { error } = await supabase.from('stages').delete().eq('id', stageId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  revalidateTag('stages')
  redirect(`/sites/${siteId}`)
}

export async function updateStage(
  _prev: EditState,
  formData: FormData
): Promise<EditState> {
  const profile = await requireAuth()
  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only supervisors and admins can edit stages.' }
  }

  const siteId  = formData.get('site_id') as string
  const stageId = formData.get('stage_id') as string
  const name    = (formData.get('name') as string)?.trim()

  if (!name) return { error: 'Stage name is required.' }

  const isContractPricing = formData.get('is_contract_pricing') === 'true'
  const rawPrice = formData.get('default_contract_price') as string
  const defaultContractPrice = rawPrice ? parseFloat(rawPrice) : null

  if (isContractPricing && defaultContractPrice !== null && (isNaN(defaultContractPrice) || defaultContractPrice < 0)) {
    return { error: 'Default contract price must be a valid positive number.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('stages')
    .update({
      name,
      is_contract_pricing: isContractPricing,
      default_contract_price: isContractPricing ? defaultContractPrice : null,
    })
    .eq('id', stageId)

  if (error) return { error: error.message }

  if (isContractPricing && defaultContractPrice !== null) {
    await supabase
      .from('lots')
      .update({ contract_price: defaultContractPrice })
      .eq('stage_id', stageId)
      .is('contract_price', null)
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath(`/sites/${siteId}`)
  revalidatePath('/invoices')
  revalidateTag('stages')
  revalidateTag('sites')
  return { success: true }
}

export async function uploadStagePlan(
  _prev: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can upload stage plans.' }

  const siteId  = formData.get('site_id') as string
  const stageId = formData.get('stage_id') as string
  const file    = formData.get('photo') as File

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10 MB).' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image.' }

  const supabase = await createClient()

  const { data: stage } = await supabase
    .from('stages')
    .select('site_plan_path')
    .eq('id', stageId)
    .single()

  const key = `site-plans/stages/${stageId}/plan.jpg`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, 'image/jpeg')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  if (stage?.site_plan_path && stage.site_plan_path !== key) {
    await deleteFromR2(stage.site_plan_path).catch(() => null)
  }

  const { error: dbError } = await supabase
    .from('stages')
    .update({ site_plan_path: key })
    .eq('id', stageId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidateTag('stages')
  return null
}
