import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { uploadSitePlan } from './actions'
import PlanPhotoUpload from './PlanPhotoUpload'
import EditSiteForm from './EditSiteForm'
import { getR2SignedUrl } from '@/lib/r2'

interface Props {
  params: Promise<{ siteId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { siteId } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('sites')
    .select('name')
    .eq('id', siteId)
    .single()
  return { title: data ? `${data.name} — Earthcare Landscapes` : 'Site' }
}

export default async function SitePage({ params }: Props) {
  const { siteId } = await params
  const profile = await requireAuth()
  const canManage = profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin = profile.role === 'admin'

  const supabase = await createClient()
  const { data: site } = await supabase
    .from('sites')
    .select(`
      id, name, address, client_contact, site_plan_path,
      stages(
        id, name, order,
        lots(id, status)
      )
    `)
    .eq('id', siteId)
    .single()

  if (!site) notFound()

  // Generate R2 signed URL for the site plan if one exists
  let sitePlanUrl: string | null = null
  if (site.site_plan_path) {
    try {
      sitePlanUrl = await getR2SignedUrl(site.site_plan_path, 3600)
    } catch {
      sitePlanUrl = null
    }
  }

  // Sort stages by their order field
  const stages = [...(site.stages ?? [])].sort((a, b) => a.order - b.order)

  // Overall site stats
  const allLots = stages.flatMap((s) => s.lots ?? [])
  const totalLots = allLots.length
  const completedLots = allLots.filter((l) => l.status === 'complete').length

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Back */}
        <Link
          href="/sites"
          className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Sites
        </Link>

        {/* Site header */}
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-stone-900">{site.name}</h1>
              {site.address && (
                <p className="mt-0.5 text-sm text-stone-500">{site.address}</p>
              )}
              {site.client_contact && (
                <p className="mt-0.5 text-sm text-stone-500">
                  Contact: {site.client_contact}
                </p>
              )}
            </div>
            {canManage && (
              <EditSiteForm
                siteId={siteId}
                name={site.name}
                address={site.address ?? null}
                clientContact={site.client_contact ?? null}
              />
            )}
          </div>

          {/* Overall progress */}
          {totalLots > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-stone-500">
                  Overall progress
                </span>
                <span className="text-xs text-stone-500">
                  {completedLots}/{totalLots} lots complete
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-stone-100">
                <div
                  className="h-2 rounded-full bg-green-600 transition-all"
                  style={{
                    width: `${Math.round((completedLots / totalLots) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Site plan ──────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-stone-800">Site plan</h2>
          </div>

          {sitePlanUrl ? (
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <a href={sitePlanUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sitePlanUrl}
                  alt="Site plan"
                  className="w-full object-contain max-h-[60vh] hover:opacity-95 transition-opacity"
                />
              </a>
              {isAdmin && (
                <div className="p-4 border-t border-stone-100">
                  <PlanPhotoUpload
                    action={uploadSitePlan}
                    hiddenFields={{ site_id: siteId }}
                    hasPlan={true}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              {isAdmin ? (
                <PlanPhotoUpload
                  action={uploadSitePlan}
                  hiddenFields={{ site_id: siteId }}
                  hasPlan={false}
                />
              ) : (
                <p className="text-sm text-stone-400 text-center py-4">No site plan uploaded yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Stages section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-stone-800">Stages</h2>
            {canManage && (
              <Link
                href={`/sites/${siteId}/new-stage`}
                className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
              >
                + Add stage
              </Link>
            )}
          </div>

          {stages.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center">
              <p className="text-sm text-stone-500">No stages yet.</p>
              {canManage && (
                <Link
                  href={`/sites/${siteId}/new-stage`}
                  className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline"
                >
                  Add the first stage →
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
              {stages.map((stage) => {
                const lots = stage.lots ?? []
                const total = lots.length
                const completed = lots.filter((l) => l.status === 'complete').length
                const inProgress = lots.filter((l) => l.status === 'in_progress').length
                const scheduled = lots.filter((l) => l.status === 'scheduled').length
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                return (
                  <Link
                    key={stage.id}
                    href={`/sites/${siteId}/stages/${stage.id}`}
                    className="flex items-center gap-4 px-4 py-4 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-900">
                        {stage.name}
                      </p>

                      {/* Status pills */}
                      {total > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {completed > 0 && (
                            <StatusPill label={`${completed} complete`} color="green" />
                          )}
                          {inProgress > 0 && (
                            <StatusPill label={`${inProgress} in progress`} color="blue" />
                          )}
                          {scheduled > 0 && (
                            <StatusPill label={`${scheduled} scheduled`} color="amber" />
                          )}
                          {total - completed - inProgress - scheduled > 0 && (
                            <StatusPill
                              label={`${total - completed - inProgress - scheduled} not started`}
                              color="stone"
                            />
                          )}
                        </div>
                      )}

                      {/* Progress bar */}
                      {total > 0 && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-stone-100">
                            <div
                              className="h-1.5 rounded-full bg-green-600"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-stone-400 shrink-0">
                            {pct}%
                          </span>
                        </div>
                      )}

                      {total === 0 && (
                        <p className="mt-0.5 text-xs text-stone-400">No lots yet</p>
                      )}
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
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function StatusPill({
  label,
  color,
}: {
  label: string
  color: 'green' | 'blue' | 'amber' | 'stone'
}) {
  const styles = {
    green: 'bg-green-100 text-green-700',
    blue:  'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    stone: 'bg-stone-100 text-stone-500',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[color]}`}>
      {label}
    </span>
  )
}
