'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

import type { ActionState, EditState, UploadActionState } from '@/types/actions'

export async function setStageComplete(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can mark stages as complete.' }

  const siteId  = formData.get('site_id')  as string
  const stageId = formData.get('stage_id') as string
  if (!stageId) return { error: 'Stage ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('stages')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', stageId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  revalidateTag('stages')
  return null
}

export async function setStageActive(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can reactivate stages.' }

  const siteId  = formData.get('site_id')  as string
  const stageId = formData.get('stage_id') as string
  if (!stageId) return { error: 'Stage ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('stages')
    .update({ completed_at: null })
    .eq('id', stageId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  revalidateTag('stages')
  return null
}

export async function deleteSite(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete sites.' }

  const siteId = formData.get('site_id') as string
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('site_plan_path')
    .eq('id', siteId)
    .single()

  if (site?.site_plan_path) {
    await deleteFromR2(site.site_plan_path).catch(() => null)
  }

  const { error } = await supabase.from('sites').delete().eq('id', siteId)
  if (error) return { error: error.message }

  revalidatePath('/sites')
  revalidateTag('sites')
  redirect('/sites')
}

export async function uploadSitePlanDoc(
  _prev: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can upload site plans.' }

  const siteId = formData.get('site_id') as string
  const label  = (formData.get('label') as string)?.trim() || null
  const file   = formData.get('photo') as File

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10 MB).' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image.' }

  const key = `site-plans/sites/${siteId}/${crypto.randomUUID()}.jpg`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, 'image/jpeg')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('site_plan_documents').insert({
    site_id:      siteId,
    storage_path: key,
    label,
    uploaded_by:  profile.id,
  })

  if (dbError) {
    await deleteFromR2(key).catch(() => null)
    return { error: dbError.message }
  }

  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  return null
}

export async function renameSitePlanDoc(
  _prev: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can rename site plans.' }

  const siteId = formData.get('site_id') as string
  const docId  = formData.get('doc_id') as string
  const label  = (formData.get('label') as string)?.trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('site_plan_documents')
    .update({ label })
    .eq('id', docId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  return null
}

export async function deleteSitePlanDoc(
  _prev: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete site plans.' }

  const siteId = formData.get('site_id') as string
  const docId  = formData.get('doc_id') as string

  const supabase = await createClient()
  const { data: doc } = await supabase
    .from('site_plan_documents')
    .select('storage_path')
    .eq('id', docId)
    .single()

  if (doc?.storage_path) {
    await deleteFromR2(doc.storage_path).catch(() => null)
  }

  const { error } = await supabase.from('site_plan_documents').delete().eq('id', docId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  return null
}

export async function updateSite(
  _prev: EditState,
  formData: FormData
): Promise<EditState> {
  const profile = await requireAuth()
  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only supervisors and admins can edit sites.' }
  }

  const siteId        = formData.get('site_id') as string
  const name          = (formData.get('name') as string)?.trim()
  const address       = (formData.get('address') as string)?.trim() || null
  const clientContact = (formData.get('client_contact') as string)?.trim() || null

  if (!name) return { error: 'Site name is required.' }

  const updates: Record<string, unknown> = { name, address, client_contact: clientContact }
  // Checkbox: present = 'true', absent = unchecked = false. Admin-only.
  if (profile.role === 'admin') {
    updates.has_client_extras = formData.get('has_client_extras') === 'true'
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sites')
    .update(updates)
    .eq('id', siteId)

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}`)
  revalidatePath('/sites')
  revalidateTag('sites')
  return { success: true }
}

export async function uploadSitePlan(
  _prev: UploadActionState,
  formData: FormData
): Promise<UploadActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can upload site plans.' }

  const siteId = formData.get('site_id') as string
  const file   = formData.get('photo') as File

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10 MB).' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image.' }

  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('site_plan_path')
    .eq('id', siteId)
    .single()

  // Always store as .jpg since compression converts to JPEG
  const key = `site-plans/sites/${siteId}/plan.jpg`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, 'image/jpeg')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  // Remove old file if the key changed (e.g. legacy path)
  if (site?.site_plan_path && site.site_plan_path !== key) {
    await deleteFromR2(site.site_plan_path).catch(() => null)
  }

  const { error: dbError } = await supabase
    .from('sites')
    .update({ site_plan_path: key })
    .eq('id', siteId)

  if (dbError) return { error: dbError.message }

  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  return null
}
