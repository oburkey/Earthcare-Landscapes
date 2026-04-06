'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

export async function createExtraJob(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to add extra jobs.' }
  }

  const stageId = formData.get('stage_id') as string
  const siteId  = formData.get('site_id') as string
  const title   = (formData.get('title') as string)?.trim()

  if (!title) return { error: 'Title is required.' }
  if (!stageId) return { error: 'Stage ID is missing.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('extra_jobs')
    .insert({
      stage_id:    stageId,
      title,
      description: (formData.get('description') as string)?.trim() || null,
      status:      (formData.get('status') as string) || 'not_started',
      notes:       (formData.get('notes') as string)?.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  redirect(`/sites/${siteId}/stages/${stageId}/extra-jobs/${data.id}`)
}
