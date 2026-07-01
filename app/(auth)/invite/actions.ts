'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function acceptInvite(formData: FormData) {
  const token     = formData.get('token') as string
  const firstName = (formData.get('first_name') as string)?.trim()
  const lastName  = (formData.get('last_name') as string)?.trim()
  const password  = formData.get('password') as string

  if (!firstName || !lastName) return { error: 'First and last name are required.' }
  if (!password || password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const supabase = await createClient()

  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, email, role, profile_id, accepted_at')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (!invitation) return { error: 'This invitation is no longer valid.' }

  if (!invitation.profile_id) {
    return { error: 'This invitation uses an older format. Please ask an admin to re-send your invite.' }
  }

  const admin = createAdminClient()

  // Set the password on the existing stub auth user
  const { error: updateError } = await admin.auth.admin.updateUserById(
    invitation.profile_id,
    { password, email_confirm: true }
  )

  if (updateError) return { error: updateError.message }

  // Activate the profile and set their name
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      first_name: firstName,
      last_name:  lastName,
      role:       invitation.role,
      has_login:  true,
    })
    .eq('id', invitation.profile_id)

  if (profileError) return { error: 'Password set but profile update failed. Contact support.' }

  // Mark invitation accepted
  await admin
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return { success: true }
}
