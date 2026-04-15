'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import type { ActionState } from '@/types/actions'

export async function updateExtraJob(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to edit extra jobs.' }
  }

  const extraJobId = formData.get('extra_job_id') as string
  const siteId     = formData.get('site_id') as string
  const stageId    = formData.get('stage_id') as string
  const title      = (formData.get('title') as string)?.trim()

  if (!title) return { error: 'Title is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('extra_jobs')
    .update({
      title,
      description: (formData.get('description') as string)?.trim() || null,
      status:      formData.get('status') as string,
      notes:       (formData.get('notes') as string)?.trim() || null,
    })
    .eq('id', extraJobId)

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/extra-jobs/${extraJobId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidateTag('stages')
  revalidateTag('schedule')
  redirect(`/sites/${siteId}/stages/${stageId}/extra-jobs/${extraJobId}`)
}

export async function uploadExtraJobPhoto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  const extraJobId = formData.get('extra_job_id') as string
  const siteId     = formData.get('site_id') as string
  const stageId    = formData.get('stage_id') as string
  const photoType  = formData.get('photo_type') as string
  const file       = formData.get('photo') as File

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10 MB).' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image.' }
  if (!['before', 'during', 'after'].includes(photoType)) return { error: 'Invalid photo type.' }

  const key = `extra-job-photos/${extraJobId}/${crypto.randomUUID()}.jpg`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, file.type)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('extra_job_photos').insert({
    extra_job_id: extraJobId,
    storage_path: key,
    photo_type:   photoType,
    uploaded_by:  profile.id,
  })

  if (dbError) {
    await deleteFromR2(key)
    return { error: dbError.message }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/extra-jobs/${extraJobId}`)
  return null
}
