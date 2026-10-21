import { requireAuth, requireRole } from '@/lib/auth'
import FilesView from './FilesView'

export const metadata = { title: 'Files — Earthcare Landscapes' }

export default async function FilesPage() {
  const profile = await requireAuth()
  // Admin-only for now. The DB/RLS already allows all staff, so lowering
  // this (plus the nav link and the site page tab) is all it takes to open up.
  requireRole(profile, 'admin')

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-fg">Files</h1>
          <p className="mt-0.5 text-sm text-fg-muted">Photos and documents from every site, stage and lot.</p>
        </div>
        <FilesView profile={profile} />
      </div>
    </div>
  )
}
