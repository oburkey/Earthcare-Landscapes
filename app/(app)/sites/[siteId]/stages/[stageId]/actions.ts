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

// 'due_only' is the original format (single date column = due date).
// 'start_and_due' adds an explicit Start Date column ahead of Due Date —
// either can be left blank on a given line.
export type BulkDateMode = 'due_only' | 'start_and_due'

export type BulkPreviewRow = {
  line: string
  lotNumber: string | null
  startDate: string | null // ISO, or null if not supplied
  dueDate: string | null   // ISO, or null if not supplied
  homeDesign: string | null
  action: 'update' | 'create' | null
  error: string | null
}

// Strip leading zeros for comparison so "019" matches "19", "030" matches "30"
function stripZeros(s: string): string {
  return s.replace(/^0+/, '') || '0'
}

function parseDatePart(raw: string, fieldLabel: string): { iso: string | null; error: string | null } {
  if (!raw) return { iso: null, error: null }
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return { iso: null, error: `invalid ${fieldLabel} "${raw}" — expected DD/MM/YYYY` }
  const [, dd, mm, yyyy] = match
  const day = parseInt(dd, 10), month = parseInt(mm, 10), year = parseInt(yyyy, 10)
  const dt = new Date(year, month - 1, day)
  if (dt.getDate() !== day || dt.getMonth() !== month - 1 || dt.getFullYear() !== year) {
    return { iso: null, error: `"${raw}" is not a valid calendar date` }
  }
  return { iso: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`, error: null }
}

// One line -> lot number / start date / due date / home design, or an error.
// Shared by both the preview (dry-run) and commit paths so validation never
// drifts between what the admin previews and what actually gets written.
function parseBulkLine(line: string, mode: BulkDateMode): BulkPreviewRow {
  const parts = line.split(/[\t,]/).map(p => p.trim())
  if (parts.length < 2) {
    return { line, lotNumber: null, startDate: null, dueDate: null, homeDesign: null, action: null,
      error: `missing separator — expected tab or comma between lot number and date` }
  }
  const lotNumber = parts[0]
  if (!lotNumber) {
    return { line, lotNumber: null, startDate: null, dueDate: null, homeDesign: null, action: null, error: 'missing lot number' }
  }

  if (mode === 'due_only') {
    const dueRaw = parts[1] ?? ''
    const homeDesign = parts[2] || null
    if (!dueRaw) {
      return { line, lotNumber, startDate: null, dueDate: null, homeDesign, action: null, error: `Lot ${lotNumber}: due date is required` }
    }
    const due = parseDatePart(dueRaw, 'date')
    if (due.error) return { line, lotNumber, startDate: null, dueDate: null, homeDesign, action: null, error: `Lot ${lotNumber}: ${due.error}` }
    return { line, lotNumber, startDate: null, dueDate: due.iso, homeDesign, action: null, error: null }
  }

  // start_and_due: lot, start date, due date, home design — start/due each optional
  const startRaw = parts[1] ?? ''
  const dueRaw    = parts[2] ?? ''
  const homeDesign = parts[3] || null
  const start = parseDatePart(startRaw, 'start date')
  if (start.error) return { line, lotNumber, startDate: null, dueDate: null, homeDesign, action: null, error: `Lot ${lotNumber}: ${start.error}` }
  const due = parseDatePart(dueRaw, 'due date')
  if (due.error) return { line, lotNumber, startDate: start.iso, dueDate: null, homeDesign, action: null, error: `Lot ${lotNumber}: ${due.error}` }
  if (!start.iso && !due.iso && !homeDesign) {
    return { line, lotNumber, startDate: null, dueDate: null, homeDesign, action: null, error: `Lot ${lotNumber}: nothing to update — give a start date, due date, or home design` }
  }
  return { line, lotNumber, startDate: start.iso, dueDate: due.iso, homeDesign, action: null, error: null }
}

async function requireBulkUpdatePermission(): Promise<string | null> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return 'Insufficient permissions'
  }
  return null
}

// Dry run — parses and resolves update-vs-create per line without writing
// anything, so the UI can show exactly what will happen before the admin
// confirms.
export async function previewBulkUpdateLots(
  stageId: string,
  rawData: string,
  mode: BulkDateMode,
): Promise<BulkPreviewRow[]> {
  const permError = await requireBulkUpdatePermission()
  const lines = rawData.split('\n').map(l => l.trim()).filter(Boolean)
  if (permError) return lines.map((line) => ({ line, lotNumber: null, startDate: null, dueDate: null, homeDesign: null, action: null, error: permError }))
  if (lines.length === 0) return []

  const supabase = await createClient()
  const { data: existingLots } = await supabase
    .from('lots')
    .select('lot_number')
    .eq('stage_id', stageId)
  const existingLotNumbers = new Set((existingLots ?? []).map(l => stripZeros(l.lot_number as string)))

  return lines.map((line) => {
    const parsed = parseBulkLine(line, mode)
    if (parsed.error || !parsed.lotNumber) return parsed
    return { ...parsed, action: existingLotNumbers.has(stripZeros(parsed.lotNumber)) ? 'update' : 'create' }
  })
}

export async function bulkUpdateLots(
  stageId: string,
  siteId:  string,
  rawData: string,
  mode: BulkDateMode = 'due_only',
): Promise<BulkUpdateResult> {
  const permError = await requireBulkUpdatePermission()
  if (permError) return { updated: 0, created: 0, errors: [permError] }

  const lines = rawData.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { updated: 0, created: 0, errors: [] }

  const supabase = await createClient()

  const { data: existingLots } = await supabase
    .from('lots')
    .select('id, lot_number, status')
    .eq('stage_id', stageId)

  const lotsMap = new Map(
    (existingLots ?? []).map(l => [stripZeros(l.lot_number as string), l as { id: string; lot_number: string; status: string }])
  )

  const errors: string[] = []
  let updated = 0
  let created = 0

  for (const line of lines) {
    const parsed = parseBulkLine(line, mode)
    if (parsed.error || !parsed.lotNumber) {
      errors.push(parsed.error ?? `"${line}": could not be parsed`)
      continue
    }
    const { lotNumber, startDate, dueDate, homeDesign } = parsed

    const existing = lotsMap.get(stripZeros(lotNumber))
    if (existing) {
      const noDowngrade = existing.status === 'complete' || existing.status === 'in_progress'
      const newStatus   = noDowngrade ? existing.status : 'scheduled'
      const update: Record<string, unknown> = {}
      if (dueDate) update.due_date = dueDate
      if (startDate) update.scheduled_date = startDate
      if (homeDesign) update.home_design = homeDesign
      if (dueDate || startDate) update.status = newStatus
      const { error } = await supabase
        .from('lots')
        .update(update)
        .eq('id', existing.id)
      if (error) {
        errors.push(`Lot ${lotNumber}: ${error.message}`)
      } else {
        updated++
        lotsMap.set(stripZeros(lotNumber), { ...existing, status: (update.status as string) ?? existing.status })
      }
    } else {
      const { data: newLot, error } = await supabase
        .from('lots')
        .insert({
          stage_id: stageId, lot_number: lotNumber, status: 'scheduled',
          due_date: dueDate, scheduled_date: startDate, home_design: homeDesign,
        })
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
