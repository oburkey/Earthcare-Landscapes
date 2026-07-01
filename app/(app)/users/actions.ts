'use server'

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Role } from '@/types/database'

export async function createInvite(formData: FormData) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const profileId = formData.get('profile_id') as string

  const supabase = await createClient()

  const { data: target } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, has_login')
    .eq('id', profileId)
    .single()

  if (!target) return { error: 'Profile not found.' }
  if (target.has_login) return { error: 'This person already has an active login account.' }
  if (!target.email) return { error: 'This person has no email address. Edit their profile to add one first.' }

  // Check for an existing pending invite for this profile
  const { data: existing } = await supabase
    .from('invitations')
    .select('id')
    .eq('profile_id', profileId)
    .is('accepted_at', null)
    .maybeSingle()

  if (existing) return { error: 'This person already has a pending invitation. Revoke it first if you need to resend.' }

  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({
      email:      target.email,
      role:       target.role as Role,
      invited_by: profile.id,
      profile_id: profileId,
    })
    .select('token')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/users')
  return { success: true, token: invite.token as string }
}

export async function revokeInvite(inviteId: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', inviteId)
    .is('accepted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/users')
  return { success: true }
}
