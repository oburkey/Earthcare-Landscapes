'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function acceptInvite(formData: FormData) {
  const token     = formData.get('token')     as string
  const firstName = (formData.get('first_name') as string)?.trim()
  const lastName  = (formData.get('last_name')  as string)?.trim()
  const password  = formData.get('password')  as string

  if (!password || password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const admin = createAdminClient()

  const { data: invitation } = await admin
    .from('invitations')
    .select('id, email, role, profile_id, accepted_at, sent_at, created_at')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (!invitation) return { error: 'This invitation is no longer valid.' }

  // Re-check expiry server-side
  const base      = new Date(invitation.sent_at ?? invitation.created_at)
  const expiresAt = new Date(base)
  expiresAt.setDate(expiresAt.getDate() + 7)
  if (expiresAt < new Date()) return { error: 'This invitation has expired. Ask an admin to send a new one.' }

  const now = new Date().toISOString()

  // ── Staff-first flow (profile_id is set) ───────────────────────────────────
  // The auth user already exists as a stub. Just set the password.

  if (invitation.profile_id) {
    if (!firstName || !lastName) return { error: 'Name is required.' }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      invitation.profile_id,
      { password, email_confirm: true }
    )
    if (updateError) return { error: updateError.message }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName, role: invitation.role, has_login: true })
      .eq('id', invitation.profile_id)

    if (profileError) return { error: 'Password set but profile update failed. Contact support.' }

    await admin
      .from('invitations')
      .update({ accepted_at: now })
      .eq('id', invitation.id)

    return { success: true }
  }

  // ── Email-only flow (profile_id is null) ───────────────────────────────────
  // No stub user exists yet. Create a fresh auth user + profile.

  if (!firstName || !lastName) return { error: 'First and last name are required.' }

  const { data: { user }, error: createError } = await admin.auth.admin.createUser({
    email:         invitation.email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  })

  if (createError || !user) {
    return { error: createError?.message ?? 'Failed to create account.' }
  }

  // The handle_new_user() trigger has already created a profiles row for this user.
  // Update it with the correct role and name from the invitation.
  await admin
    .from('profiles')
    .update({ first_name: firstName, last_name: lastName, role: invitation.role, has_login: true })
    .eq('id', user.id)

  // Mark accepted and link to the newly created profile
  await admin
    .from('invitations')
    .update({ accepted_at: now, profile_id: user.id })
    .eq('id', invitation.id)

  return { success: true }
}
