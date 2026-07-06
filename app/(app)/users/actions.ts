'use server'

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendInviteEmail } from '@/lib/email'
import type { Role } from '@/types/database'

const ROLE_LABELS: Record<Role, string> = {
  worker: 'Worker', leading_hand: 'Leading Hand',
  supervisor: 'Supervisor', admin: 'Admin', client: 'Client',
}

function buildInviteUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/invite?token=${token}`
}

// ── Staff-first invite (profile_id is set, name locked to what admin entered) ─

export async function createInvite(formData: FormData) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const profileId = formData.get('profile_id') as string
  const supabase  = await createClient()

  const { data: target } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, has_login')
    .eq('id', profileId)
    .single()

  if (!target)         return { error: 'Profile not found.' }
  if (target.has_login) return { error: 'This person already has an active login account.' }
  if (!target.email)   return { error: 'This person has no email address. Edit their profile to add one first.' }

  const { data: existing } = await supabase
    .from('invitations')
    .select('id')
    .eq('profile_id', profileId)
    .is('accepted_at', null)
    .maybeSingle()

  if (existing) return { error: 'This person already has a pending invitation. Revoke it first to resend.' }

  const now = new Date().toISOString()

  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({
      email:      target.email,
      role:       target.role as Role,
      invited_by: profile.id,
      profile_id: profileId,
      sent_at:    now,
    })
    .select('token')
    .single()

  if (error) return { error: error.message }

  const url = buildInviteUrl(invite.token as string)
  await sendInviteEmail({
    to:        target.email,
    inviteUrl: url,
    roleLabel: ROLE_LABELS[target.role as Role] ?? target.role,
    firstName: target.first_name ?? undefined,
  }).catch(() => {}) // email failure must not block invite creation

  revalidatePath('/users')
  return { success: true, email: target.email as string }
}

// ── Email-only invite (no pre-existing staff record, user sets own name) ──────

export async function createEmailInvite(formData: FormData) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role  = formData.get('role') as Role

  if (!email) return { error: 'Email is required.' }
  if (!role)  return { error: 'Role is required.' }

  const admin    = createAdminClient()
  const supabase = await createClient()

  // Block if this email already has an active account
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, has_login')
    .ilike('email', email)
    .maybeSingle()

  if (existingProfile?.has_login) {
    return { error: 'An account with this email already exists.' }
  }

  // Block duplicate pending invites for this email
  const { data: existingInvite } = await supabase
    .from('invitations')
    .select('id')
    .ilike('email', email)
    .is('accepted_at', null)
    .maybeSingle()

  if (existingInvite) {
    return { error: 'A pending invitation for this email already exists. Revoke it first.' }
  }

  const now = new Date().toISOString()

  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({
      email,
      role,
      invited_by: profile.id,
      profile_id: null, // null = email-only; no stub user yet
      sent_at:    now,
    })
    .select('token')
    .single()

  if (error) return { error: error.message }

  await sendInviteEmail({
    to:        email,
    inviteUrl: buildInviteUrl(invite.token as string),
    roleLabel: ROLE_LABELS[role] ?? role,
  }).catch(() => {})

  revalidatePath('/users')
  return { success: true, email }
}

// ── Resend — revokes old token and issues a fresh one ─────────────────────────

export async function resendInvite(inviteId: string) {
  const profile  = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('invitations')
    .select('id, email, role, profile_id, accepted_at')
    .eq('id', inviteId)
    .single()

  if (!existing)           return { error: 'Invitation not found.' }
  if (existing.accepted_at) return { error: 'This invitation has already been accepted.' }

  await supabase.from('invitations').delete().eq('id', inviteId)

  const now = new Date().toISOString()

  const { data: invite, error } = await supabase
    .from('invitations')
    .insert({
      email:      existing.email,
      role:       existing.role as Role,
      invited_by: profile.id,
      profile_id: existing.profile_id,
      sent_at:    now,
    })
    .select('token')
    .single()

  if (error) return { error: error.message }

  await sendInviteEmail({
    to:        existing.email,
    inviteUrl: buildInviteUrl(invite.token as string),
    roleLabel: ROLE_LABELS[existing.role as Role] ?? existing.role,
  }).catch(() => {})

  revalidatePath('/users')
  return { success: true, email: existing.email as string }
}

// ── Revoke ─────────────────────────────────────────────────────────────────────

export async function revokeInvite(inviteId: string) {
  const profile  = await requireAuth()
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

// ── Save email address for a no-email staff record ────────────────────────────

export async function saveProfileEmail(profileId: string, email: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }

  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { error: 'Email is required.' }

  const admin = createAdminClient()

  // Ensure this is a non-login staff record (safety guard)
  const { data: target } = await admin
    .from('profiles')
    .select('has_login')
    .eq('id', profileId)
    .single()

  if (!target)           return { error: 'Profile not found.' }
  if (target.has_login)  return { error: 'Use the Staff page to edit active user profiles.' }

  const { error } = await admin
    .from('profiles')
    .update({ email: trimmed })
    .eq('id', profileId)

  if (error) return { error: error.message }

  revalidatePath('/users')
  return { success: true, email: trimmed }
}

// ── Delete active user account ────────────────────────────────────────────────

export async function deleteUserAccount(profileId: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin only.' }
  if (profileId === profile.id) return { error: 'You cannot delete your own account.' }

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('profiles')
    .select('has_login, first_name, last_name')
    .eq('id', profileId)
    .single()

  if (!target)          return { error: 'User not found.' }
  if (!target.has_login) return { error: 'Not an active login account. Use the Staff page to remove stub records.' }

  // DB migration_profile_fk_set_null.sql added ON DELETE SET NULL to all FK
  // references to profiles(id), so deleting the auth user is sufficient —
  // Postgres nulls all author/submitted-by fields automatically.
  const { error } = await admin.auth.admin.deleteUser(profileId)
  if (error) return { error: error.message }

  revalidatePath('/users')
  revalidatePath('/staff')
  return { success: true }
}
