'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function acceptInvite(formData: FormData) {
  const token = formData.get('token') as string
  const fullName = formData.get('full_name') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  // Re-fetch the invitation to get email and role
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (!invitation) {
    return { error: 'This invitation is no longer valid.' }
  }

  // Create the Supabase auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: invitation.email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (signUpError || !signUpData.user) {
    return { error: signUpError?.message ?? 'Could not create account.' }
  }

  // The profiles row is created by a DB trigger (see schema.sql).
  // We update it with the correct role and name.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: fullName, role: invitation.role })
    .eq('id', signUpData.user.id)

  if (profileError) {
    return { error: 'Account created but profile setup failed. Contact support.' }
  }

  // Mark the invitation as used
  await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  redirect('/dashboard')
}
