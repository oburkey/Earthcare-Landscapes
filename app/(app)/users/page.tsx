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

  const [
    { data: invitableRaw },
    { data: noEmailRaw },
    { data: pendingRaw },
    { data: activeUsersRaw },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .eq('has_login', false)
      .not('email', 'is', null)
      .neq('role', 'client')
      .order('last_name').order('first_name'),
    supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('has_login', false)
      .is('email', null)
      .neq('role', 'client')
      .order('last_name').order('first_name'),
    supabase
      .from('invitations')
      .select('id, email, role, token, created_at, sent_at, profile_id')
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .eq('has_login', true)
      .order('last_name').order('first_name'),
  ])

  // IDs that already have a pending invite — remove from "invitable" list
  const pendingProfileIds = new Set(
    (pendingRaw ?? []).filter(i => i.profile_id).map(i => i.profile_id as string)
  )

  const invitable = (invitableRaw ?? [])
    .filter(p => !pendingProfileIds.has(p.id))
    .map(p => ({
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
    id:        i.id,
    email:     i.email,
    role:      i.role as Role,
    roleLabel: ROLE_LABELS[i.role as Role] ?? i.role,
    token:     i.token,
    createdAt: i.created_at,
    sentAt:    i.sent_at as string | null,
    profileId: i.profile_id as string | null,
  }))

  const activeUsers = (activeUsersRaw ?? []).map(u => ({
    id:        u.id,
    name:      `${u.first_name} ${u.last_name}`.trim(),
    email:     u.email as string | null,
    roleLabel: ROLE_LABELS[u.role as Role] ?? u.role,
    role:      u.role as Role,
  }))

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <UsersClient
          invitable={invitable}
          noEmail={noEmail}
          pending={pending}
          activeUsers={activeUsers}
          currentUserId={profile.id}
        />
      </div>
    </div>
  )
}
