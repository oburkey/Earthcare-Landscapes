'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type ActionState = { error: string } | null

export async function createStage(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to add stages.' }
  }

  const siteId = formData.get('site_id') as string
  const name = (formData.get('name') as string)?.trim()

  if (!name) return { error: 'Stage name is required.' }
  if (!siteId) return { error: 'Site ID is missing.' }

  const supabase = await createClient()

  // Put new stage at the end of the current order
  const { data: existing } = await supabase
    .from('stages')
    .select('order')
    .eq('site_id', siteId)
    .order('order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.order ?? -1) + 1

  const { error } = await supabase.from('stages').insert({
    site_id: siteId,
    name,
    order: nextOrder,
  })

  if (error) return { error: error.message }

  revalidatePath(`/sites/${siteId}`)
  redirect(`/sites/${siteId}`)
}
