'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { MutationState } from '@/types/actions'

export async function createStaffMember(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to add staff.' }
  }

  const fullName    = (formData.get('full_name') as string)?.trim()
  const phoneNumber = (formData.get('phone_number') as string)?.trim() || null
  const role        = formData.get('role') as string

  const credentialsRaw = (formData.get('credentials') as string) ?? ''
  const credentials = credentialsRaw.split('\n').map((c) => c.trim()).filter(Boolean)

  if (!fullName) return { error: 'Name is required.' }

  const allowedRoles = profile.role === 'admin'
    ? ['worker', 'leading_hand', 'supervisor', 'admin']
    : ['worker', 'leading_hand']

  if (!allowedRoles.includes(role)) {
    return { error: 'You cannot set that role.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('staff_members').insert({
    full_name:    fullName,
    phone_number: phoneNumber,
    role,
    credentials,
  })

  if (error) return { error: error.message }

  revalidatePath('/staff')
  revalidateTag('staff')
  return { success: 'Staff member added.' }
}

export async function updateStaffMember(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to edit staff.' }
  }

  const memberId    = formData.get('member_id') as string
  const fullName    = (formData.get('full_name') as string)?.trim()
  const phoneNumber = (formData.get('phone_number') as string)?.trim() || null
  const role        = formData.get('role') as string

  const credentialsRaw = (formData.get('credentials') as string) ?? ''
  const credentials = credentialsRaw.split('\n').map((c) => c.trim()).filter(Boolean)

  if (!fullName) return { error: 'Name is required.' }

  const allowedRoles = profile.role === 'admin'
    ? ['worker', 'leading_hand', 'supervisor', 'admin']
    : ['worker', 'leading_hand']

  if (!allowedRoles.includes(role)) {
    return { error: 'You cannot set that role.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('staff_members')
    .update({ full_name: fullName, phone_number: phoneNumber, role, credentials })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/staff')
  revalidateTag('staff')
  return { success: 'Staff member updated.' }
}

export async function deleteStaffMember(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to remove staff.' }
  }

  const memberId = formData.get('member_id') as string

  const supabase = await createClient()
  const { error } = await supabase.from('staff_members').delete().eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/staff')
  revalidateTag('staff')
  return { success: 'Staff member removed.' }
}
