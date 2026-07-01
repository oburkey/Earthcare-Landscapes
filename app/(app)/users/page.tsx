import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'
import type { Role } from '@/types/database'

export const metadata = { title: 'User Management — Earthcare Landscapes' }

const ROLE_LABELS: Record<Role, string> = {
  worker: 'Worker', leading_hand: 'Leading Hand',
  supervisor: 'Supervisor', admin: 'Admin', client: 'Client',
}

export default async function UsersPage() {
  const profile = await requireAuth()
  requireRole(profile, 'admin')

  const supabase = await createClient()

  // Staff without login accounts who have an email (can be invited)
  const { data: invitableRaw } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .eq('has_login', false)
    .not('email', 'is', null)
    .neq('role', 'client')
    .order('last_name')
    .order('first_name')

  // Staff without login and without email (can't be invited yet)
  const { data: noEmailRaw } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('has_login', false)
    .is('email', null)
    .neq('role', 'client')
    .order('last_name')
    .order('first_name')

  // Pending invitations
  const { data: pendingRaw } = await supabase
    .from('invitations')
    .select('id, email, role, token, created_at, profile_id')
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  const invitable = (invitableRaw ?? []).map(p => ({
    id:        p.id,
    name:      `${p.first_name} ${p.last_name}`.trim(),
    email:     p.email as string,
    roleLabel: ROLE_LABELS[p.role as Role] ?? p.role,
    role:      p.role as Role,
  }))

  const noEmail = (noEmailRaw ?? []).map(p => ({
    id:        p.id,
    name:      `${p.first_name} ${p.last_name}`.trim(),
    roleLabel: ROLE_LABELS[p.role as Role] ?? p.role,
  }))

  const pending = (pendingRaw ?? []).map(i => ({
    id:         i.id,
    email:      i.email,
    role:       i.role as Role,
    roleLabel:  ROLE_LABELS[i.role as Role] ?? i.role,
    token:      i.token,
    createdAt:  i.created_at,
    profileId:  i.profile_id,
  }))

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <UsersClient
          invitable={invitable}
          noEmail={noEmail}
          pending={pending}
        />
      </div>
    </div>
  )
}
