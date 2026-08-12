'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { TRADE_OPTIONS, PHOTO_CATEGORIES } from '@/lib/lotStatus'
import { CHECKLIST_SECTIONS, GATING_ITEM_KEYS } from '@/lib/checklist'
import type { ActionState } from '@/types/actions'

const SUPERVISOR_FLAGS = ['build_complete'] as const
const ADMIN_FLAGS      = ['invoiced', 'has_client_extras', 'pending_review', 'approved_for_invoicing'] as const
type LotFlag = typeof SUPERVISOR_FLAGS[number] | typeof ADMIN_FLAGS[number]

export async function toggleLotFlag(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  const lotId   = formData.get('lot_id')   as string
  const siteId  = formData.get('site_id')  as string
  const stageId = formData.get('stage_id') as string
  const flag    = formData.get('flag')     as string
  const value   = formData.get('value') === 'true'

  const allFlags: string[] = [...SUPERVISOR_FLAGS, ...ADMIN_FLAGS]
  if (!allFlags.includes(flag)) return { error: 'Invalid flag.' }

  if ((ADMIN_FLAGS as readonly string[]).includes(flag)) {
    if (profile.role !== 'admin') return { error: 'Only admins can toggle this flag.' }
  } else {
    if (profile.role !== 'supervisor' && profile.role !== 'admin') {
      return { error: 'Only supervisors and admins can toggle this.' }
    }
  }

  const supabase = await createClient()
  const update: Record<string, unknown> = { [flag as LotFlag]: value }
  if (flag === 'build_complete') {
    update.build_completed_at = value ? new Date().toISOString() : null
  }
  if (flag === 'approved_for_invoicing' && value === true) {
    update.pending_review = false
  }
  const { error } = await supabase
    .from('lots')
    .update(update)
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  return null
}

export async function updateLotHomeDesign(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only supervisors and admins can edit Home Design.' }
  }

  const lotId   = formData.get('lot_id')   as string
  const siteId  = formData.get('site_id')  as string
  const stageId = formData.get('stage_id') as string
  const homeDesign = (formData.get('home_design') as string)?.trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('lots')
    .update({ home_design: homeDesign })
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidateTag('stages')
  return null
}

function canManageDelay(role: string): boolean {
  return role === 'leading_hand' || role === 'supervisor' || role === 'admin'
}

function revalidateAfterDelayChange(siteId: string, stageId: string, lotId: string) {
  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath('/schedule')
  revalidatePath('/dashboard')
  revalidateTag('stages')
  revalidateTag('schedule')
  revalidateTag('dashboard')
}

export async function setLotDelayed(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageDelay(profile.role)) return { error: 'Only leading hands and above can mark a lot as delayed.' }

  const lotId   = formData.get('lot_id')   as string
  const siteId  = formData.get('site_id')  as string
  const stageId = formData.get('stage_id') as string
  const reason  = (formData.get('delay_reason') as string)?.trim()
  const expectedCompletionDate = (formData.get('expected_completion_date') as string) || null

  if (!reason) return { error: 'A reason is required.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lots')
    .update({ delayed: true, delay_reason: reason, expected_completion_date: expectedCompletionDate })
    .eq('id', lotId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Update failed — the lot could not be found or you do not have permission to edit it.' }

  revalidateAfterDelayChange(siteId, stageId, lotId)
  return null
}

export async function clearLotDelayed(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageDelay(profile.role)) return { error: 'Only leading hands and above can remove a delay.' }

  const lotId   = formData.get('lot_id')   as string
  const siteId  = formData.get('site_id')  as string
  const stageId = formData.get('stage_id') as string

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lots')
    .update({ delayed: false, delay_reason: null, expected_completion_date: null })
    .eq('id', lotId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Update failed — the lot could not be found or you do not have permission to edit it.' }

  revalidateAfterDelayChange(siteId, stageId, lotId)
  return null
}

export async function uploadLotDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to upload documents.' }
  }

  const lotId        = formData.get('lot_id') as string
  const siteId       = formData.get('site_id') as string
  const stageId      = formData.get('stage_id') as string
  const documentName = (formData.get('document_name') as string)?.trim()
  const documentType = formData.get('document_type') as string
  const file         = formData.get('file') as File

  if (!documentName) return { error: 'Document name is required.' }
  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 20 * 1024 * 1024) return { error: 'File too large (max 20 MB).' }
  // iOS/iPadOS reports an unreliable File.type for PDFs picked via several
  // file providers (Files app / iCloud Drive / some scanner apps) — it can
  // come through as '', 'application/octet-stream', or similar even for a
  // genuine PDF, which desktop browsers never do. The filename extension is
  // the one signal iOS preserves consistently, so trust it as a fallback
  // instead of hard-rejecting a valid PDF just because the MIME type is odd.
  const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!looksLikePdf) return { error: 'File must be a PDF.' }
  if (!['site_plan', 'drawing', 'housing_claim', 'other'].includes(documentType)) {
    return { error: 'Invalid document type.' }
  }

  const key = `lot-documents/${lotId}/${crypto.randomUUID()}.pdf`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, 'application/pdf')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('lot_documents').insert({
    lot_id:        lotId,
    storage_path:  key,
    document_name: documentName,
    document_type: documentType,
    uploaded_by:   profile.id,
  })

  if (dbError) {
    await deleteFromR2(key).catch(() => null)
    return { error: dbError.message }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidateTag('schedule')
  return null
}

export async function uploadLotPhoto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  const lotId        = formData.get('lot_id') as string
  const siteId       = formData.get('site_id') as string
  const stageId      = formData.get('stage_id') as string
  const photoType    = formData.get('photo_type') as string
  const photoCategory = (formData.get('photo_category') as string) || null
  const notes        = (formData.get('notes') as string)?.trim() || null
  const file         = formData.get('photo') as File

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10 MB).' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image.' }
  if (!['before', 'during', 'after'].includes(photoType)) return { error: 'Invalid photo type.' }
  if (photoCategory && !(PHOTO_CATEGORIES as readonly string[]).includes(photoCategory)) {
    return { error: 'Invalid photo category.' }
  }

  const key = `lot-photos/${lotId}/${crypto.randomUUID()}.jpg`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, file.type)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('lot_photos').insert({
    lot_id:        lotId,
    storage_path:  key,
    photo_type:    photoType,
    photo_category: photoCategory,
    notes,
    uploaded_by:   profile.id,
  })

  if (dbError) {
    await deleteFromR2(key).catch(() => null)
    return { error: dbError.message }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  return null
}

export async function deleteLot(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete lots.' }

  const lotId   = formData.get('lot_id') as string
  const siteId  = formData.get('site_id') as string
  const stageId = formData.get('stage_id') as string
  const supabase = await createClient()

  // Clean up R2 files before deleting DB row
  const [{ data: photos }, { data: docs }] = await Promise.all([
    supabase.from('lot_photos').select('storage_path').eq('lot_id', lotId),
    supabase.from('lot_documents').select('storage_path').eq('lot_id', lotId),
  ])
  await Promise.all([
    ...(photos ?? []).map((p) => deleteFromR2(p.storage_path).catch(() => null)),
    ...(docs ?? []).map((d) => deleteFromR2(d.storage_path).catch(() => null)),
  ])

  const { error } = await supabase.from('lots').delete().eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath(`/sites/${siteId}`)
  revalidateTag('stages')
  revalidateTag('sites')
  redirect(`/sites/${siteId}/stages/${stageId}`)
}

export async function deleteLotDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete documents.' }

  const documentId = formData.get('document_id') as string
  const siteId     = formData.get('site_id') as string
  const stageId    = formData.get('stage_id') as string
  const lotId      = formData.get('lot_id') as string

  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('lot_documents')
    .select('storage_path')
    .eq('id', documentId)
    .single()

  if (doc?.storage_path) {
    await deleteFromR2(doc.storage_path).catch(() => null)
  }

  const { error } = await supabase.from('lot_documents').delete().eq('id', documentId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  return null
}

export async function updateTradeStatus(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only leading hands and above can update trade status.' }
  }

  const lotId   = formData.get('lot_id')   as string
  const siteId  = formData.get('site_id')  as string
  const stageId = formData.get('stage_id') as string
  if (!lotId) return { error: 'Lot ID is missing.' }

  const tradesCompleted = formData.getAll('trades_completed')
    .map((t) => String(t))
    .filter((t) => (TRADE_OPTIONS as readonly string[]).includes(t))

  const readyForLandscaping = formData.get('ready_for_landscaping') === 'true'
  const blockingNotes = (formData.get('blocking_notes') as string)?.trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('lot_trade_status')
    .upsert({
      lot_id: lotId,
      trades_completed: tradesCompleted,
      ready_for_landscaping: readyForLandscaping,
      blocking_notes: readyForLandscaping ? null : blockingNotes,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lot_id' })

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath('/schedule')
  revalidateTag('trade-status')
  return null
}

export async function updateChecklist(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only leading hands and above can update the checklist.' }
  }

  const lotId   = formData.get('lot_id')   as string
  const siteId  = formData.get('site_id')  as string
  const stageId = formData.get('stage_id') as string
  if (!lotId) return { error: 'Lot ID is missing.' }

  const today = new Date().toISOString().split('T')[0]

  const rows = CHECKLIST_SECTIONS.flatMap((section) =>
    section.items.map((item) => {
      const dateRaw = (formData.get(`date__${item.key}`) as string) || null

      let completed: boolean
      let response: string | null = null

      if (item.type === 'yesno') {
        const r = formData.get(`response__${item.key}`) as string
        response = r === 'yes' || r === 'no' ? r : null
        completed = response !== null
      } else {
        completed = formData.get(`completed__${item.key}`) === 'true'
      }

      return {
        lot_id: lotId,
        section: section.id,
        item_key: item.key,
        completed,
        response,
        completed_date: completed ? (dateRaw || today) : dateRaw,
      }
    })
  )

  const extrasNotes = (formData.get('extras_notes') as string)?.trim() || null

  const supabase = await createClient()

  const { error: checklistError } = await supabase
    .from('lot_checklist_items')
    .upsert(rows, { onConflict: 'lot_id,item_key' })
  if (checklistError) return { error: checklistError.message }

  const { error: notesError } = await supabase
    .from('lots')
    .update({ extras_notes: extrasNotes })
    .eq('id', lotId)
  if (notesError) return { error: notesError.message }

  // Auto-complete the lot once every gating item has been completed/answered.
  // A manual "un-tick" of build_complete only holds until the checklist is
  // saved again with all gating items still complete.
  const allGatingComplete = rows
    .filter((r) => GATING_ITEM_KEYS.has(r.item_key))
    .every((r) => r.completed)

  if (allGatingComplete) {
    const { data: lotRow } = await supabase
      .from('lots')
      .select('build_completed_at')
      .eq('id', lotId)
      .single()

    const update: { build_complete: true; build_completed_at?: string } = { build_complete: true }
    if (!lotRow?.build_completed_at) update.build_completed_at = new Date().toISOString()

    await supabase.from('lots').update(update).eq('id', lotId)
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidateTag('stages')
  revalidateTag('dashboard')
  revalidateTag('schedule')
  return null
}

export async function updateLot(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  const lotId = formData.get('lot_id') as string
  const siteId = formData.get('site_id') as string
  const stageId = formData.get('stage_id') as string
  const newStatus = formData.get('status') as string
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!lotId) return { error: 'Lot ID is missing.' }

  const updates: Record<string, unknown> = {
    status: newStatus,
    notes,
    completion_date:
      newStatus === 'complete' ? new Date().toISOString().split('T')[0] : null,
  }

  // Leading hands, supervisors and admins can also update dates and contract price
  if (profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin') {
    const rawDue = formData.get('due_date') as string
    const rawScheduled = formData.get('scheduled_date') as string
    updates.due_date = rawDue || null
    updates.scheduled_date = rawScheduled || null

    const rawContractPrice = formData.get('contract_price') as string | null
    if (rawContractPrice !== null) {
      updates.contract_price = rawContractPrice ? parseFloat(rawContractPrice) : null
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('lots').update(updates).eq('id', lotId)

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidateTag('stages')
  revalidateTag('dashboard')
  revalidateTag('schedule')
  redirect(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
}
