'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type ActionState = { error: string } | null

export async function createLot(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  if (profile.role !== 'leading_hand' && profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to add lots.' }
  }

  const stageId = formData.get('stage_id') as string
  const siteId = formData.get('site_id') as string
  const lotNumber = (formData.get('lot_number') as string)?.trim()

  if (!lotNumber) return { error: 'Lot number is required.' }
  if (!stageId) return { error: 'Stage ID is missing.' }

  const rawDue = formData.get('due_date') as string
  const rawScheduled = formData.get('scheduled_date') as string

  const supabase = await createClient()
  const { error } = await supabase.from('lots').insert({
    stage_id: stageId,
    lot_number: lotNumber,
    status: (formData.get('status') as string) || 'not_started',
    due_date: rawDue || null,
    scheduled_date: rawScheduled || null,
    notes: (formData.get('notes') as string)?.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}/stages/${stageId}`)
  redirect(`/sites/${siteId}/stages/${stageId}`)
}
