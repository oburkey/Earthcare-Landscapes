'use client'

import Link from 'next/link'
import { STATUS_CONFIG, EXTRA_JOB_STATUS_CONFIG, DELAYED_BADGE_CLASS, formatDate } from '@/lib/lotStatus'
import type { LotStatus, ExtraJobStatus } from '@/types/database'
import InlineCheckbox from './InlineCheckbox'
import { toggleChecklistItemInline, toggleBuildCompleteInline } from './checklist-inline-actions'

export type TableLotRow = {
  id: string
  lotNumber: string
  dueDate: string | null
  status: LotStatus
  delayed: boolean
  delayReason: string | null
  buildComplete: boolean
  tradesCompleted: string[]
  // Used only by the Cards view (StageCardView), carried here so both views
  // can share one row shape built once in page.tsx.
  invoiced: boolean
  quantDone: boolean
}

export type TableExtraJobRow = {
  id: string
  title: string
  dueDate: string | null
  status: ExtraJobStatus
  delayed: boolean
  delayReason: string | null
}

export type ChecklistColumn = { key: string; label: string; shortLabel: string }

interface Props {
  lots: TableLotRow[]
  extraJobs: TableExtraJobRow[]
  checklistMap: Record<string, Record<string, boolean>>
  checklistColumns: ChecklistColumn[]
  siteId: string
  stageId: string
  canTickChecklist: boolean
  canToggleBuildComplete: boolean
}

function TradeMark({ done }: { done: boolean }) {
  return (
    <span className={done ? 'text-green-600 dark:text-green-400' : 'text-fg-muted'}>
      {done ? '✓' : '✗'}
    </span>
  )
}

export default function StageLotsTable({
  lots, extraJobs, checklistMap, checklistColumns, siteId, stageId, canTickChecklist, canToggleBuildComplete,
}: Props) {
  if (lots.length === 0 && extraJobs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
        <p className="text-sm text-fg-muted">No lots or extra jobs in this stage yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-raised text-fg-muted">
            <th className="text-left font-medium px-3 py-2 whitespace-nowrap sticky left-0 bg-surface-raised">Lot</th>
            <th className="text-left font-medium px-2 py-2 whitespace-nowrap">Due date</th>
            <th className="text-left font-medium px-2 py-2 whitespace-nowrap">Status</th>
            <th className="text-left font-medium px-2 py-2 whitespace-nowrap">Delayed</th>
            <th className="text-center font-medium px-2 py-2 whitespace-nowrap">Fencer</th>
            <th className="text-center font-medium px-2 py-2 whitespace-nowrap">Concreter</th>
            {checklistColumns.map((col) => (
              <th key={col.key} title={col.label} className="text-center font-medium px-2 py-2 whitespace-nowrap">
                {col.shortLabel}
              </th>
            ))}
            <th className="text-center font-medium px-2 py-2 whitespace-nowrap">Build Complete</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => {
            const cfg = STATUS_CONFIG[lot.status] ?? STATUS_CONFIG.not_started
            const items = checklistMap[lot.id] ?? {}
            return (
              <tr key={lot.id} className="border-b border-border-subtle hover:bg-surface-raised/60">
                <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-surface">
                  <Link href={`/sites/${siteId}/stages/${stageId}/lots/${lot.id}`} className="font-medium text-accent-fg hover:underline">
                    Lot {lot.lotNumber}
                  </Link>
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-fg-muted">{formatDate(lot.dueDate)}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {lot.delayed && (
                    <span title={lot.delayReason ?? undefined} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DELAYED_BADGE_CLASS}`}>
                      Delayed
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center"><TradeMark done={lot.tradesCompleted.includes('Fencer')} /></td>
                <td className="px-2 py-2 text-center"><TradeMark done={lot.tradesCompleted.includes('Concreter')} /></td>
                {checklistColumns.map((col) => (
                  <td key={col.key} className="px-2 py-2 text-center">
                    <InlineCheckbox
                      checked={items[col.key] ?? false}
                      disabled={!canTickChecklist}
                      action={toggleChecklistItemInline}
                      label={col.label}
                      hiddenFields={{ lot_id: lot.id, site_id: siteId, stage_id: stageId, item_key: col.key }}
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-center">
                  <InlineCheckbox
                    checked={lot.buildComplete}
                    disabled={!canToggleBuildComplete}
                    action={toggleBuildCompleteInline}
                    label="Build Complete"
                    hiddenFields={{ lot_id: lot.id, site_id: siteId, stage_id: stageId }}
                  />
                </td>
              </tr>
            )
          })}

          {extraJobs.length > 0 && (
            <tr className="border-b border-border bg-surface-raised">
              <td colSpan={7 + checklistColumns.length} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                Extra jobs
              </td>
            </tr>
          )}
          {extraJobs.map((job) => {
            const cfg = EXTRA_JOB_STATUS_CONFIG[job.status] ?? EXTRA_JOB_STATUS_CONFIG.not_started
            return (
              <tr key={job.id} className="border-b border-border-subtle hover:bg-surface-raised/60">
                <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-surface" colSpan={1}>
                  <Link href={`/sites/${siteId}/stages/${stageId}/extra-jobs/${job.id}`} className="font-medium text-accent-fg hover:underline">
                    {job.title}
                  </Link>
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-fg-muted">{formatDate(job.dueDate)}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {job.delayed && (
                    <span title={job.delayReason ?? undefined} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DELAYED_BADGE_CLASS}`}>
                      Delayed
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center text-fg-muted" colSpan={2 + checklistColumns.length}>—</td>
                <td className="px-2 py-2 text-center text-fg-muted">—</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
