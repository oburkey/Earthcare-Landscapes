import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getCachedSitesList } from '@/lib/data'
import SiteListActions from './SiteListActions'

export const metadata = { title: 'Sites & Lots — Earthcare Landscapes' }

export default async function SitesPage() {
  const profile = await requireAuth()
  const canManage = profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin   = profile.role === 'admin'

  const sites = await getCachedSitesList()

  type SiteRow = NonNullable<typeof sites>[number]

  function siteStats(site: SiteRow) {
    const allLots = (site.stages ?? []).flatMap((s: { lots?: { status: string }[] }) => s.lots ?? [])
    const total     = allLots.length
    const completed = allLots.filter((l: { status: string }) => l.status === 'complete').length
    return { total, completed, stageCount: (site.stages ?? []).length }
  }

  const activeSites = (sites ?? [])
    .filter((s: SiteRow) => !(s as { completed_at?: string | null }).completed_at)
    .map((s: SiteRow) => ({ id: s.id, name: s.name, address: s.address ?? null, ...siteStats(s) }))

  const completedSites = (sites ?? [])
    .filter((s: SiteRow) => !!(s as { completed_at?: string | null }).completed_at)
    .map((s: SiteRow) => ({ id: s.id, name: s.name, address: s.address ?? null, ...siteStats(s) }))

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-900">Sites</h1>
          {canManage && (
            <Link
              href="/sites/new"
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
            >
              + Add site
            </Link>
          )}
        </div>

        <SiteListActions
          activeSites={activeSites}
          completedSites={completedSites}
          isAdmin={isAdmin}
        />

      </div>
    </div>
  )
}
