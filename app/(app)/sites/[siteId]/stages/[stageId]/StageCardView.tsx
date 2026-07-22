import Link from 'next/link'
import { PrefetchLink } from '@/app/_components/PrefetchLink'
import { STATUS_CONFIG, EXTRA_JOB_STATUS_CONFIG, DELAYED_BADGE_CLASS, formatDate, tradeStatusBadge, type TradeStatusSummary } from '@/lib/lotStatus'
import type { TableLotRow, TableExtraJobRow } from './StageLotsTable'
import BulkUpdateLotsButton from './BulkUpdateLotsButton'

interface Props {
  lots: TableLotRow[]
  extraJobs: TableExtraJobRow[]
  tradeStatusMap: Record<string, TradeStatusSummary>
  siteId: string
  stageId: string
  canAddLot: boolean
  canManageExtraJobs: boolean
}

// Original card view, extracted unchanged from the stage page so it can sit
// alongside the new Overview/Checklist table views as the third toggle option.
export default function StageCardView({
  lots, extraJobs, tradeStatusMap, siteId, stageId, canAddLot, canManageExtraJobs,
}: Props) {
  return (
    <div className="space-y-5">
      {/* ── Lots list ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
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
              const cfg = STATUS_CONFIG[lot.status] ?? STATUS_CONFIG.not_started
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
                        Lot {lot.lotNumber}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      {lot.delayed && (
                        <span
                          title={lot.delayReason ?? undefined}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${DELAYED_BADGE_CLASS}`}
                        >
                          Delayed
                        </span>
                      )}
                      {tradeBadge && !lot.buildComplete && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tradeBadge.badge}`}>
                          {tradeBadge.label}
                        </span>
                      )}
                      {lot.invoiced ? (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          Invoiced
                        </span>
                      ) : lot.quantDone ? (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-surface-raised text-fg-muted">
                          Quant Done
                        </span>
                      ) : null}
                    </div>
                    {lot.dueDate && (
                      <p className="mt-1 text-xs text-fg-muted">
                        Due {formatDate(lot.dueDate)}
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

        {extraJobs.length === 0 ? (
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
              const cfg = EXTRA_JOB_STATUS_CONFIG[job.status] ?? EXTRA_JOB_STATUS_CONFIG.not_started
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
                      {job.delayed && (
                        <span
                          title={job.delayReason ?? undefined}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${DELAYED_BADGE_CLASS}`}
                        >
                          Delayed
                        </span>
                      )}
                    </div>
                    {job.dueDate && (
                      <p className="mt-0.5 text-xs text-fg-muted">
                        Due {formatDate(job.dueDate)}
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
    </div>
  )
}
