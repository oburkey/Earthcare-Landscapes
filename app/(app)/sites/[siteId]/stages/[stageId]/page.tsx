import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getCachedStage, getCachedTradeStatusByLotIds } from '@/lib/data'
import { PrefetchLink } from '@/app/_components/PrefetchLink'
import { STATUS_CONFIG, EXTRA_JOB_STATUS_CONFIG, formatDate, tradeStatusBadge } from '@/lib/lotStatus'
import type { LotStatus, ExtraJobStatus } from '@/types/database'
import { uploadStagePlan } from './actions'
import PlanPhotoUpload from '../../PlanPhotoUpload'
import EditStageForm from './EditStageForm'
import MaterialsSummary from './MaterialsSummary'
import BulkUpdateLotsButton from './BulkUpdateLotsButton'
import { getR2SignedUrl } from '@/lib/r2'

interface Props {
  params: Promise<{ siteId: string; stageId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { stageId } = await params
  const { stage } = await getCachedStage(stageId)
  const site = stage ? (Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as unknown as { name: string } | null) : null
  return {
    title: stage ? `${stage.name} — ${site?.name ?? ''} — Earthcare Landscapes` : 'Stage',
  }
}

async function uploadStagePlanAction(formData: FormData) {
  'use server'
  return uploadStagePlan(null, formData)
}

export default async function StagePage({ params }: Props) {
  const { siteId, stageId } = await params
  const profile = await requireAuth()
  const canAddLot          = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'
  const canManageExtraJobs = profile.role === 'leading_hand' || profile.role === 'supervisor' || profile.role === 'admin'
  const canManageStage     = profile.role === 'supervisor' || profile.role === 'admin'
  const isAdmin            = profile.role === 'admin'
  const showSummary        = profile.role === 'supervisor' || profile.role === 'admin'

  const { stage, extraJobs } = await getCachedStage(stageId)

  if (!stage) notFound()

  const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }
  const lots = [...(stage.lots ?? [])].sort((a, b) =>
    a.lot_number.localeCompare(b.lot_number, undefined, { numeric: true })
  )

  const total = lots.length
  const completed = lots.filter((l) => l.status === 'complete').length

  const tradeStatusMap = await getCachedTradeStatusByLotIds(lots.map((l) => l.id))

  // Generate R2 signed URL for the stage plan if one exists
  let stagePlanUrl: string | null = null
  if (stage.site_plan_path) {
    try {
      stagePlanUrl = await getR2SignedUrl(stage.site_plan_path, 3600)
    } catch {
      stagePlanUrl = null
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-fg-muted">
          <Link href="/sites" className="hover:text-fg-secondary">Sites</Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-fg-secondary truncate max-w-[120px]">
            {site.name}
          </Link>
          <span>/</span>
          <span className="text-fg-secondary font-medium">{stage.name}</span>
        </nav>

        {/* Stage header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-fg">{stage.name}</h1>
              {canManageStage && (
                <EditStageForm
                  siteId={siteId}
                  stageId={stageId}
                  name={stage.name}
                  isAdmin={isAdmin}
                  isContractPricing={(stage as unknown as { is_contract_pricing?: boolean }).is_contract_pricing ?? false}
                  defaultContractPrice={(stage as unknown as { default_contract_price?: number | null }).default_contract_price ?? null}
                />
              )}
            </div>
            {total > 0 && (
              <p className="mt-0.5 text-sm text-fg-muted">
                {completed}/{total} lots complete
              </p>
            )}
          </div>
          {canAddLot && (
            <Link
              href={`/sites/${siteId}/stages/${stageId}/new-lot`}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900 shrink-0"
            >
              + Add lot
            </Link>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="h-2 w-full rounded-full bg-surface-raised">
            <div
              className="h-2 rounded-full bg-green-600 transition-all"
              style={{ width: `${Math.round((completed / total) * 100)}%` }}
            />
          </div>
        )}

        {/* ── Stage plan ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-fg-secondary">Stage plan</h2>
          </div>

          {stagePlanUrl ? (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <a href={stagePlanUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stagePlanUrl}
                  alt="Stage plan"
                  className="w-full object-contain max-h-[60vh] hover:opacity-95 transition-opacity"
                />
              </a>
              {isAdmin && (
                <div className="p-4 border-t border-border-subtle">
                  <PlanPhotoUpload
                    action={uploadStagePlanAction}
                    hiddenFields={{ site_id: siteId, stage_id: stageId }}
                    hasPlan={true}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5">
              {isAdmin ? (
                <PlanPhotoUpload
                  action={uploadStagePlanAction}
                  hiddenFields={{ site_id: siteId, stage_id: stageId }}
                  hasPlan={false}
                />
              ) : (
                <p className="text-sm text-fg-muted text-center py-4">No stage plan uploaded yet.</p>
              )}
            </div>
          )}
        </div>

        {/* ── Lots list ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-fg-secondary">Lots</h2>
          </div>
          {canAddLot && <BulkUpdateLotsButton stageId={stageId} siteId={siteId} />}

          {lots.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
              <p className="text-sm text-fg-muted">No lots in this stage yet.</p>
              {canAddLot && (
                <Link
                  href={`/sites/${siteId}/stages/${stageId}/new-lot`}
                  className="mt-3 inline-block text-sm font-medium text-accent-fg hover:underline"
                >
                  Add the first lot →
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
              {lots.map((lot) => {
                const status = lot.status as LotStatus
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started
                const tradeBadge = tradeStatusBadge(tradeStatusMap[lot.id])
                return (
                  <PrefetchLink
                    key={lot.id}
                    href={`/sites/${siteId}/stages/${stageId}/lots/${lot.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-raised active:bg-surface-raised transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-fg">
                          Lot {lot.lot_number}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {tradeBadge && !(lot as unknown as { build_complete?: boolean }).build_complete && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tradeBadge.badge}`}>
                            {tradeBadge.label}
                          </span>
                        )}
                      </div>
                      {lot.due_date && (
                        <p className="mt-1 text-xs text-fg-muted">
                          Due {formatDate(lot.due_date)}
                        </p>
                      )}
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-fg-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </PrefetchLink>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Extra Jobs ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-fg-secondary">Extra jobs</h2>
            {canManageExtraJobs && (
              <Link
                href={`/sites/${siteId}/stages/${stageId}/extra-jobs/new`}
                className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900"
              >
                + Add job
              </Link>
            )}
          </div>

          {!extraJobs || extraJobs.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
              <p className="text-sm text-fg-muted">No extra jobs yet.</p>
              {canManageExtraJobs && (
                <Link
                  href={`/sites/${siteId}/stages/${stageId}/extra-jobs/new`}
                  className="mt-3 inline-block text-sm font-medium text-accent-fg hover:underline"
                >
                  Add the first extra job →
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
              {extraJobs.map((job) => {
                const jobStatus = job.status as ExtraJobStatus
                const cfg = EXTRA_JOB_STATUS_CONFIG[jobStatus] ?? EXTRA_JOB_STATUS_CONFIG.not_started
                return (
                  <Link
                    key={job.id}
                    href={`/sites/${siteId}/stages/${stageId}/extra-jobs/${job.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-raised active:bg-surface-raised transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-fg">{job.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {job.description && (
                        <p className="mt-0.5 text-xs text-fg-muted truncate">{job.description}</p>
                      )}
                      {(job as unknown as { due_date?: string }).due_date && (
                        <p className="mt-0.5 text-xs text-fg-muted">
                          Due {formatDate((job as unknown as { due_date: string }).due_date)}
                        </p>
                      )}
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-fg-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Materials Summary ────────────────────────────────────────────── */}
        {showSummary && (
          <div>
            <h2 className="text-base font-semibold text-fg-secondary mb-3">Materials Summary</h2>
            <MaterialsSummary stageId={stageId} siteId={siteId} />
          </div>
        )}

      </div>
    </div>
  )
}
