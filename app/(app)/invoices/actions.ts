'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

export async function toggleInvoiced(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can toggle Invoiced.' }

  const lotId = formData.get('lot_id') as string
  const value = formData.get('value') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('lots')
    .update({ invoiced: value })
    .eq('id', lotId)
  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return null
}
