'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { MutationState } from '@/types/actions'

export async function createContact(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to add contacts.' }
  }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('contacts').insert({
    name,
    company:  (formData.get('company') as string)?.trim()  || null,
    phone:    (formData.get('phone') as string)?.trim()    || null,
    email:    (formData.get('email') as string)?.trim()    || null,
    category: (formData.get('category') as string)?.trim() || null,
    notes:    (formData.get('notes') as string)?.trim()    || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  revalidateTag('contacts')
  return { success: 'Contact added.' }
}

export async function updateContact(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to edit contacts.' }
  }

  const contactId = formData.get('contact_id') as string
  const name      = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({
      name,
      company:  (formData.get('company') as string)?.trim()  || null,
      phone:    (formData.get('phone') as string)?.trim()    || null,
      email:    (formData.get('email') as string)?.trim()    || null,
      category: (formData.get('category') as string)?.trim() || null,
      notes:    (formData.get('notes') as string)?.trim()    || null,
    })
    .eq('id', contactId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  revalidateTag('contacts')
  return { success: 'Contact updated.' }
}

export async function deleteContact(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to delete contacts.' }
  }

  const contactId = formData.get('contact_id') as string

  const supabase = await createClient()
  const { error } = await supabase.from('contacts').delete().eq('id', contactId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  revalidateTag('contacts')
  return { success: 'Contact deleted.' }
}
