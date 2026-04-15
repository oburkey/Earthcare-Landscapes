'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'

import type { EditState, UploadActionState } from '@/types/actions'

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

  const supabase = await createClient()
  const { error } = await supabase
    .from('stages')
    .update({ name })
    .eq('id', stageId)

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath(`/sites/${siteId}`)
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
