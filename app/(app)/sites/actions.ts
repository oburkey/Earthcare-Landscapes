'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { ActionState } from '@/types/actions'

export async function setSiteComplete(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can mark sites as complete.' }

  const siteId = formData.get('site_id') as string
  if (!siteId) return { error: 'Site ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sites')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', siteId)
  if (error) return { error: error.message }

  revalidatePath('/sites')
  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  revalidateTag('dashboard')
  return null
}

export async function setSiteActive(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can reactivate sites.' }

  const siteId = formData.get('site_id') as string
  if (!siteId) return { error: 'Site ID is missing.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sites')
    .update({ completed_at: null })
    .eq('id', siteId)
  if (error) return { error: error.message }

  revalidatePath('/sites')
  revalidatePath(`/sites/${siteId}`)
  revalidateTag('sites')
  revalidateTag('dashboard')
  return null
}
