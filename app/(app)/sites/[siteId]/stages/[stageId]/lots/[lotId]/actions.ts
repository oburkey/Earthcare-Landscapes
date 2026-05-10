'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import type { ActionState } from '@/types/actions'

const SUPERVISOR_FLAGS = ['build_complete', 'quant_done'] as const
const ADMIN_FLAGS      = ['invoiced'] as const
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
    if (profile.role !== 'admin') return { error: 'Only admins can toggle Invoiced.' }
  } else {
    if (profile.role !== 'supervisor' && profile.role !== 'admin') {
      return { error: 'Only supervisors and admins can toggle this.' }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('lots')
    .update({ [flag as LotFlag]: value })
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
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
  if (file.type !== 'application/pdf') return { error: 'File must be a PDF.' }
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
    await deleteFromR2(key)
    return { error: dbError.message }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  return null
}

export async function uploadLotPhoto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  const lotId     = formData.get('lot_id') as string
  const siteId    = formData.get('site_id') as string
  const stageId   = formData.get('stage_id') as string
  const photoType = formData.get('photo_type') as string
  const file      = formData.get('photo') as File

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10 MB).' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image.' }
  if (!['before', 'during', 'after'].includes(photoType)) return { error: 'Invalid photo type.' }

  const key = `lot-photos/${lotId}/${crypto.randomUUID()}.jpg`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, file.type)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('lot_photos').insert({
    lot_id:       lotId,
    storage_path: key,
    photo_type:   photoType,
    uploaded_by:  profile.id,
  })

  if (dbError) {
    await deleteFromR2(key)
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

  // Leading hands, supervisors and admins can also update dates
  if (profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin') {
    const rawDue = formData.get('due_date') as string
    const rawScheduled = formData.get('scheduled_date') as string
    updates.due_date = rawDue || null
    updates.scheduled_date = rawScheduled || null
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
