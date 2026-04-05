import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import StaffManagement from './StaffManagement'
import type { Role } from '@/types/database'

export const metadata = { title: 'Staff — Earthcare Landscapes' }

export default async function StaffPage() {
  const profile = await requireAuth()
  requireRole(profile, 'supervisor')

  const supabase = await createClient()

  const { data: staffData } = await supabase
    .from('staff_members')
    .select('id, full_name, phone_number, credentials, role')
    .order('full_name', { ascending: true })

  const staff = (staffData ?? []).map((s) => ({
    id:           s.id as string,
    full_name:    (s.full_name ?? '') as string,
    phone_number: (s.phone_number ?? null) as string | null,
    credentials:  ((s.credentials as string[]) ?? []),
    role:         s.role as Role,
  }))

  const allowedRoles: Role[] = profile.role === 'admin'
    ? ['worker', 'leading_hand', 'supervisor', 'admin']
    : ['worker', 'leading_hand']

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <StaffManagement
          staff={staff}
          canManage={true}
          allowedRoles={allowedRoles}
        />
      </div>
    </div>
  )
}
