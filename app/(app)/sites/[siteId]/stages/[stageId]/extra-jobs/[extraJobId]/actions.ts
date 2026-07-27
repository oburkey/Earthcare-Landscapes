'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import { PHOTO_CATEGORIES } from '@/lib/lotStatus'
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
      due_date:    (formData.get('due_date') as string) || null,
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

function canManageDelay(role: string): boolean {
  return role === 'leading_hand' || role === 'supervisor' || role === 'admin'
}

function revalidateAfterDelayChange(siteId: string, stageId: string, extraJobId: string) {
  revalidatePath(`/sites/${siteId}/stages/${stageId}/extra-jobs/${extraJobId}`)
  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidatePath('/schedule')
  revalidatePath('/dashboard')
  revalidateTag('stages')
  revalidateTag('schedule')
  revalidateTag('dashboard')
}

export async function setExtraJobDelayed(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageDelay(profile.role)) return { error: 'Only leading hands and above can mark a job as delayed.' }

  const extraJobId = formData.get('extra_job_id') as string
  const siteId      = formData.get('site_id') as string
  const stageId     = formData.get('stage_id') as string
  const reason       = (formData.get('delay_reason') as string)?.trim()
  const expectedCompletionDate = (formData.get('expected_completion_date') as string) || null

  if (!reason) return { error: 'A reason is required.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extra_jobs')
    .update({ delayed: true, delay_reason: reason, expected_completion_date: expectedCompletionDate })
    .eq('id', extraJobId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Update failed — the job could not be found or you do not have permission to edit it.' }

  revalidateAfterDelayChange(siteId, stageId, extraJobId)
  return null
}

export async function clearExtraJobDelayed(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (!canManageDelay(profile.role)) return { error: 'Only leading hands and above can remove a delay.' }

  const extraJobId = formData.get('extra_job_id') as string
  const siteId      = formData.get('site_id') as string
  const stageId     = formData.get('stage_id') as string

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extra_jobs')
    .update({ delayed: false, delay_reason: null, expected_completion_date: null })
    .eq('id', extraJobId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Update failed — the job could not be found or you do not have permission to edit it.' }

  revalidateAfterDelayChange(siteId, stageId, extraJobId)
  return null
}

export async function deleteExtraJob(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can delete extra jobs.' }

  const extraJobId = formData.get('extra_job_id') as string
  const siteId     = formData.get('site_id') as string
  const stageId    = formData.get('stage_id') as string
  const supabase = await createClient()

  const { data: photos } = await supabase
    .from('extra_job_photos')
    .select('storage_path')
    .eq('extra_job_id', extraJobId)

  await Promise.all(
    (photos ?? []).map((p) => deleteFromR2(p.storage_path).catch(() => null))
  )

  const { error } = await supabase.from('extra_jobs').delete().eq('id', extraJobId)
  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  revalidateTag('stages')
  redirect(`/sites/${siteId}/stages/${stageId}`)
}

export async function uploadExtraJobPhoto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  const extraJobId  = formData.get('extra_job_id') as string
  const siteId      = formData.get('site_id') as string
  const stageId     = formData.get('stage_id') as string
  const photoType   = formData.get('photo_type') as string
  const photoCategory = (formData.get('photo_category') as string) || null
  const notes       = (formData.get('notes') as string)?.trim() || null
  const file        = formData.get('photo') as File

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10 MB).' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image.' }
  if (!['before', 'during', 'after'].includes(photoType)) return { error: 'Invalid photo type.' }
  if (photoCategory && !(PHOTO_CATEGORIES as readonly string[]).includes(photoCategory)) {
    return { error: 'Invalid photo category.' }
  }

  const key = `extra-job-photos/${extraJobId}/${crypto.randomUUID()}.jpg`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, file.type)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const supabase = await createClient()
  const { error: dbError } = await supabase.from('extra_job_photos').insert({
    extra_job_id:   extraJobId,
    storage_path:   key,
    photo_type:     photoType,
    photo_category: photoCategory,
    notes,
    uploaded_by:    profile.id,
  })

  if (dbError) {
    await deleteFromR2(key)
    return { error: dbError.message }
  }

  revalidatePath(`/sites/${siteId}/stages/${stageId}/extra-jobs/${extraJobId}`)
  return null
}
