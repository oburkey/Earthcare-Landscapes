import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getCachedSite } from '@/lib/data'
import { createClient } from '@/lib/supabase/server'
import EditSiteForm from './EditSiteForm'
import SitePlanManager from './SitePlanManager'
import StageListActions from './StageListActions'
import { getR2SignedUrlSafe } from '@/lib/r2'

interface Props {
  params: Promise<{ siteId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { siteId } = await params
  const data = await getCachedSite(siteId)
  return { title: data ? `${data.name} — Earthcare Landscapes` : 'Site' }
}

export default async function SitePage({ params }: Props) {
  const { siteId } = await params
  const profile = await requireAuth()
  const canManage = profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin = profile.role === 'admin'

  const supabase = await createClient()
  const [site, { data: planDocsRaw }] = await Promise.all([
    getCachedSite(siteId),
    supabase
      .from('site_plan_documents')
      .select('id, storage_path, label')
      .eq('site_id', siteId)
      .order('created_at', { ascending: true }),
  ])

  if (!site) notFound()

  // Generate signed URLs for each plan document
  type PlanWithUrl = { id: string; url: string; label: string | null }
  const planDocs: PlanWithUrl[] = planDocsRaw
    ? await Promise.all(
        planDocsRaw.map(async (d) => ({
          id: d.id, url: await getR2SignedUrlSafe(d.storage_path), label: d.label,
        }))
      ).then((docs) => docs.filter((d) => d.url))
    : []

  // Legacy single plan URL (shown only if no plan documents exist)
  let legacyPlanUrl: string | null = null
  if (planDocs.length === 0 && site.site_plan_path) {
    legacyPlanUrl = await getR2SignedUrlSafe(site.site_plan_path) || null
  }

  // Sort all stages by order (used for overall stats and split)
  const stages = [...(site.stages ?? [])].sort((a, b) => a.order - b.order)

  // Overall site stats — include all stages regardless of completion
  const allLots = stages.flatMap((s) => s.lots ?? [])
  const totalLots = allLots.length
  const completedLots = allLots.filter((l) => l.status === 'complete').length

  type StageRow = (typeof stages)[number]

  function stageStats(s: StageRow) {
    const lots = s.lots ?? []
    const total      = lots.length
    const completed  = lots.filter((l) => l.status === 'complete').length
    const inProgress = lots.filter((l) => l.status === 'in_progress').length
    const scheduled  = lots.filter((l) => l.status === 'scheduled').length
    return { total, completed, inProgress, scheduled }
  }

  const activeStages = stages
    .filter((s) => !(s as { completed_at?: string | null }).completed_at)
    .map((s) => ({ id: s.id, name: s.name, ...stageStats(s) }))

  const completedStages = stages
    .filter((s) => !!(s as { completed_at?: string | null }).completed_at)
    .map((s) => ({ id: s.id, name: s.name, ...stageStats(s) }))

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Back */}
        <Link
          href="/sites"
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg-secondary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Sites
        </Link>

        {/* Site header */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-fg">{site.name}</h1>
              {site.address && (
                <p className="mt-0.5 text-sm text-fg-muted">{site.address}</p>
              )}
              {site.client_contact && (
                <p className="mt-0.5 text-sm text-fg-muted">
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
                hasClientExtras={(site as { has_client_extras?: boolean }).has_client_extras ?? true}
                isAdmin={isAdmin}
              />
            )}
          </div>

          {/* Overall progress */}
          {totalLots > 0 && (
            <div className="mt-4 pt-4 border-t border-border-subtle">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-fg-muted">
                  Overall progress
                </span>
                <span className="text-xs text-fg-muted">
                  {completedLots}/{totalLots} lots complete
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-raised">
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
          <h2 className="text-base font-semibold text-fg-secondary mb-3">Site plan</h2>
          <SitePlanManager
            siteId={siteId}
            isAdmin={isAdmin}
            plans={planDocs}
            legacyPlanUrl={legacyPlanUrl}
          />
        </div>

        {/* Stages section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-fg-secondary">Stages</h2>
            {canManage && (
              <Link
                href={`/sites/${siteId}/new-stage`}
                className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
              >
                + Add stage
              </Link>
            )}
          </div>
          <StageListActions
            siteId={siteId}
            activeStages={activeStages}
            completedStages={completedStages}
            isAdmin={isAdmin}
            canManage={canManage}
          />
        </div>

      </div>
    </div>
  )
}
