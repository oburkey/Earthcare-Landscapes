// Layout for the client-facing portal.
// Separate from (app) — clean, no internal nav, no costs or invoices shown.

import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await cookies()
  const profile = await requireAuth()
  // Only client-role users (and admins previewing) can access this portal
  if (profile.role !== 'client' && profile.role !== 'admin') {
    // Supervisors and workers go back to the main app
    const { redirect } = await import('next/navigation')
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-stone-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-stone-900">Earthcare Landscapes — Site Progress</h1>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  )
}
