import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getCachedSitesList } from '@/lib/data'
import { PrefetchLink } from '@/app/_components/PrefetchLink'

export const metadata = { title: 'Sites & Lots — Earthcare Landscapes' }

export default async function SitesPage() {
  const profile = await requireAuth()
  const canManage = profile.role === 'supervisor' || profile.role === 'admin'

  const sites = await getCachedSitesList()

  type SiteRow = NonNullable<typeof sites>[number]

  function siteStats(site: SiteRow) {
    const allLots = (site.stages ?? []).flatMap((s) => s.lots ?? [])
    const total = allLots.length
    const completed = allLots.filter((l) => l.status === 'complete').length
    const stageCount = (site.stages ?? []).length
    return { total, completed, stageCount }
  }

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

        {/* Sites list */}
        {!sites || sites.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center">
            <p className="text-sm text-stone-500">No sites yet.</p>
            {canManage && (
              <Link
                href="/sites/new"
                className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline"
              >
                Add the first site →
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
            {sites.map((site) => {
              const { total, completed, stageCount } = siteStats(site)
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0

              return (
                <PrefetchLink
                  key={site.id}
                  href={`/sites/${site.id}`}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                >
                  {/* Site info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900 truncate">
                      {site.name}
                    </p>
                    {site.address && (
                      <p className="mt-0.5 text-xs text-stone-500 truncate">
                        {site.address}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-3">
                      {/* Stage count badge */}
                      <span className="text-xs text-stone-500">
                        {stageCount} stage{stageCount !== 1 ? 's' : ''}
                      </span>

                      {/* Progress */}
                      {total > 0 && (
                        <>
                          <span className="text-stone-300">·</span>
                          <span className="text-xs text-stone-500">
                            {completed}/{total} lots
                          </span>
                          <div className="flex-1 max-w-24 h-1.5 rounded-full bg-stone-100">
                            <div
                              className="h-1.5 rounded-full bg-green-600"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg
                    className="h-4 w-4 shrink-0 text-stone-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </PrefetchLink>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
