import { requireAuth } from '@/lib/auth'
import type { Role } from '@/types/database'
import AppNav from './AppNav'
import { cookies } from 'next/headers'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Direct call so Next.js static analysis marks all (app) routes as dynamic.
  await cookies()
  const profile = await requireAuth()

  return (
    <div className="min-h-screen bg-stone-50">
      <AppNav role={profile.role as Role} name={profile.full_name} />
      {/* On mobile: push content below the fixed top bar. On md+: push content right of the fixed sidebar. */}
      <div className="pt-14 md:pt-0 md:ml-60">
        {children}
      </div>
    </div>
  )
}
