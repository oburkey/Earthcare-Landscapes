'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

import type { EditState, UploadActionState } from '@/types/actions'

export async function updateSite(
  _prev: EditState,
  formData: FormData
): Promise<EditState> {
  const profile = await requireAuth()
  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'Only supervisors and admins can edit sites.' }
  }

  const siteId       = formData.get('site_id') as string
  const name         = (formData.get('name') as string)?.trim()
  const address      = (formData.get('address') as string)?.trim() || null
  const clientContact = (formData.get('client_contact') as string)?.trim() || null

  if (!name) return { error: 'Site name is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sites')
    .update({ name, address, client_contact: clientContact })
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
