import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getCachedStage, getCachedTradeStatusByLotIds } from '@/lib/data'
import { uploadStagePlan } from './actions'
import PlanPhotoUpload from '../../PlanPhotoUpload'
import EditStageForm from './EditStageForm'
import MaterialsSummary from './MaterialsSummary'
import StageViewSwitcher from './StageViewSwitcher'
import type { TableLotRow, TableExtraJobRow } from './StageLotsTable'
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
  // TEMPORARY (testing): Overview/Checklist table views are admin-only.
  // Everyone else sees Cards only, with no view toggle. To widen access
  // later, just change this line — e.g. `canManageStage` for supervisor+,
  // or `true` to open it to everyone.
  const canUseStageTableViews = isAdmin

  const { stage, extraJobs } = await getCachedStage(stageId)

  if (!stage) notFound()

  const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }
  const lots = [...(stage.lots ?? [])].sort((a, b) =>
    a.lot_number.localeCompare(b.lot_number, undefined, { numeric: true })
  )

  const total = lots.length
  const completed = lots.filter((l) => l.status === 'complete').length

  const lotIds = lots.map((l) => l.id)
  const tradeStatusMap = await getCachedTradeStatusByLotIds(lotIds)

  // All checklist items for every lot in the stage, fetched in one query
  // (not per-lot) and grouped into a lot_id -> item_key -> completed map for
  // the Overview/Checklist table views.
  const checklistMap: Record<string, Record<string, boolean>> = {}
  if (lotIds.length > 0) {
    const supabase = await createClient()
    const { data: checklistRows } = await supabase
      .from('lot_checklist_items')
      .select('lot_id, item_key, completed')
      .in('lot_id', lotIds)
    for (const row of checklistRows ?? []) {
      const forLot = checklistMap[row.lot_id] ?? {}
      forLot[row.item_key] = row.completed
      checklistMap[row.lot_id] = forLot
    }
  }

  const lotsForTable: TableLotRow[] = lots.map((lot) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lotAny = lot as any
    return {
      id: lot.id,
      lotNumber: lot.lot_number,
      dueDate: lot.due_date,
      status: lot.status,
      delayed: lotAny.delayed ?? false,
      delayReason: lotAny.delay_reason ?? null,
      buildComplete: lotAny.build_complete ?? false,
      tradesCompleted: tradeStatusMap[lot.id]?.trades_completed ?? [],
      invoiced: lotAny.invoiced ?? false,
      quantDone: lotAny.quant_done ?? false,
    }
  })

  const extraJobsForTable: TableExtraJobRow[] = (extraJobs ?? []).map((job) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobAny = job as any
    return {
      id: job.id,
      title: job.title,
      dueDate: jobAny.due_date ?? null,
      status: job.status,
      delayed: jobAny.delayed ?? false,
      delayReason: jobAny.delay_reason ?? null,
    }
  })

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

        {/* ── Lots & Extra Jobs ─────────────────────────────────────────────── */}
        <StageViewSwitcher
          lots={lotsForTable}
          extraJobs={extraJobsForTable}
          tradeStatusMap={tradeStatusMap}
          checklistMap={checklistMap}
          siteId={siteId}
          stageId={stageId}
          canAddLot={canAddLot}
          canManageExtraJobs={canManageExtraJobs}
          canTickChecklist={canAddLot}
          canToggleBuildComplete={canManageStage}
          canUseTableViews={canUseStageTableViews}
        />

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
