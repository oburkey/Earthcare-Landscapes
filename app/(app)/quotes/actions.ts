'use server'

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveQuote(
  formData: FormData
): Promise<{ error: string } | { id: string } | null> {
  const profile = await requireAuth()
  if (profile.role !== 'admin' && profile.role !== 'supervisor') {
    return { error: 'Only admins and supervisors can save quotes.' }
  }

  const id          = formData.get('id') as string | null
  const siteId      = (formData.get('site_id') as string | null) || null
  const reference   = ((formData.get('reference') as string) ?? '').trim()
  const description = ((formData.get('description') as string) ?? '').trim()
  const status      = formData.get('status') as string
  const rawItems    = formData.get('line_items') as string
  const notes       = ((formData.get('notes') as string) ?? '').trim()

  let lineItems: unknown
  try {
    lineItems = JSON.parse(rawItems || '[]')
  } catch {
    return { error: 'Invalid line items data.' }
  }

  const supabase = await createClient()

  if (id) {
    const { error } = await supabase
      .from('quotes')
      .update({
        site_id:     siteId,
        reference,
        description,
        status,
        line_items:  lineItems,
        notes,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/quotes')
    return null
  }

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      site_id:    siteId,
      reference,
      description,
      status,
      line_items: lineItems,
      notes,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/quotes')
  return { id: data.id }
}

export async function deleteQuote(
  formData: FormData
): Promise<{ error: string } | null> {
  const profile = await requireAuth()
  if (profile.role !== 'admin' && profile.role !== 'supervisor') {
    return { error: 'Only admins and supervisors can delete quotes.' }
  }

  const id = formData.get('id') as string
  const supabase = await createClient()
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/quotes')
  return null
}
