'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/types/actions'

export async function createSite(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to add sites.' }
  }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Site name is required.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sites')
    .insert({
      name,
      address: (formData.get('address') as string)?.trim() || null,
      client_contact: (formData.get('client_contact') as string)?.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/sites')
  redirect(`/sites/${data.id}`)
}
