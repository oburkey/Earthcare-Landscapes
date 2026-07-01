'use server'

import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { MutationState } from '@/types/actions'
import type { Role } from '@/types/database'

const ROLE_LEVEL: Record<Role, number> = {
  client: 0, worker: 1, leading_hand: 2, supervisor: 3, admin: 4,
}

export async function createStaffMember(
  _prevState: MutationState,
  formData: FormData
): Promise<MutationState> {
  const profile = await requireAuth()

  if (profile.role !== 'supervisor' && profile.role !== 'admin') {
    return { error: 'You do not have permission to add staff.' }
  }

  const firstName   = (formData.get('first_name') as string)?.trim()
  const lastName    = (formData.get('last_name') as string)?.trim()
  const email       = (formData.get('email') as string)?.trim() || null
  const phoneNumber = (formData.get('phone_number') as string)?.trim() || null
  const role        = formData.get('role') as string

  const credentialsRaw = (formData.get('credentials') as string) ?? ''
  const credentials = credentialsRaw.split('\n').map((c) => c.trim()).filter(Boolean)

  if (!firstName) return { error: 'First name is required.' }
  if (!lastName)  return { error: 'Last name is required.' }

  const allowedRoles = profile.role === 'admin'
    ? ['worker', 'leading_hand', 'supervisor', 'admin']
    : ['worker', 'leading_hand']

  if (!allowedRoles.includes(role)) {
    return { error: 'You cannot set that role.' }
  }

  const admin = createAdminClient()

  // Use a placeholder email if none provided — stub can't log in anyway
  const stubEmail = email ?? `staff-placeholder-${crypto.randomUUID()}@no-login.internal`

  const { data: { user }, error: createError } = await admin.auth.admin.createUser({
    email: stubEmail,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  })

  if (createError || !user) {
    return { error: createError?.message ?? 'Failed to create staff record.' }
  }

  // The handle_new_user() trigger has already created the profiles row.
  // Update it with the correct data.
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      first_name:   firstName,
      last_name:    lastName,
      email:        email,
      phone_number: phoneNumber,
      role,
      credentials,
      has_login:    false,
    })
    .eq('id', user.id)

  if (updateError) {
    // Profile update failed — clean up the orphaned auth user
    await admin.auth.admin.deleteUser(user.id).catch(() => {})
    return { error: updateError.message }
  }

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
  const firstName   = (formData.get('first_name') as string)?.trim()
  const lastName    = (formData.get('last_name') as string)?.trim()
  const email       = (formData.get('email') as string)?.trim() || null
  const phoneNumber = (formData.get('phone_number') as string)?.trim() || null
  const role        = formData.get('role') as string

  const credentialsRaw = (formData.get('credentials') as string) ?? ''
  const credentials = credentialsRaw.split('\n').map((c) => c.trim()).filter(Boolean)

  if (!firstName) return { error: 'First name is required.' }
  if (!lastName)  return { error: 'Last name is required.' }

  const allowedRoles = profile.role === 'admin'
    ? ['worker', 'leading_hand', 'supervisor', 'admin']
    : ['worker', 'leading_hand']

  if (!allowedRoles.includes(role)) {
    return { error: 'You cannot set that role.' }
  }

  // Supervisors cannot edit admins
  if (profile.role === 'supervisor') {
    const admin = createAdminClient()
    const { data: target } = await admin
      .from('profiles')
      .select('role')
      .eq('id', memberId)
      .single()
    if (target && ROLE_LEVEL[target.role as Role] >= ROLE_LEVEL['supervisor']) {
      return { error: 'You cannot edit this person.' }
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      first_name:   firstName,
      last_name:    lastName,
      email,
      phone_number: phoneNumber,
      role,
      credentials,
    })
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

  const admin = createAdminClient()

  // Safety check: only allow deleting stub users (has_login = false)
  const { data: target } = await admin
    .from('profiles')
    .select('has_login')
    .eq('id', memberId)
    .single()

  if (!target) return { error: 'Staff member not found.' }

  if (target.has_login) {
    return { error: 'This person has an active login account. Manage their account through the Users page.' }
  }

  // Delete the stub auth user — cascades to profiles via ON DELETE CASCADE
  const { error } = await admin.auth.admin.deleteUser(memberId)

  if (error) return { error: error.message }

  revalidatePath('/staff')
  revalidateTag('staff')
  return { success: 'Staff member removed.' }
}
