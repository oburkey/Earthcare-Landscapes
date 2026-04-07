import { requireAuth, requireRole } from '@/lib/auth'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAuth()
  requireRole(profile, 'admin')
  return <>{children}</>
}
