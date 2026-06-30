import { requireAuth, requireRole } from '@/lib/auth'
import SettingsNav from './SettingsNav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAuth()
  requireRole(profile, 'admin')
  return (
    <div className="min-h-screen bg-surface-raised">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <SettingsNav />
      </div>
      {children}
    </div>
  )
}
