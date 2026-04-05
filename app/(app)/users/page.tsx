import { requireAuth, requireRole } from '@/lib/auth'

export const metadata = { title: 'User Management — Earthcare Landscapes' }

export default async function UsersPage() {
  const profile = await requireAuth()
  requireRole(profile, 'admin')

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">User Management</h1>
      <p className="mt-1 text-sm text-stone-500">Coming soon.</p>
    </div>
  )
}
