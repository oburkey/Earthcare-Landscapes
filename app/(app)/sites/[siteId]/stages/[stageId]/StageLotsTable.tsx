'use client'

import Link from 'next/link'
import { STATUS_CONFIG, EXTRA_JOB_STATUS_CONFIG, DELAYED_BADGE_CLASS, formatDate, formatDateShort, delayedBadgeLabel } from '@/lib/lotStatus'
import type { LotStatus, ExtraJobStatus } from '@/types/database'
import InlineCheckbox from './InlineCheckbox'
import { toggleChecklistItemInline, toggleBuildCompleteInline } from './checklist-inline-actions'

export type TableLotRow = {
  id: string
  lotNumber: string
  homeDesign: string | null
  dueDate: string | null
  status: LotStatus
  delayed: boolean
  delayReason: string | null
  expectedCompletionDate: string | null
  buildComplete: boolean
  tradesCompleted: string[]
  // Used only by the Cards view (StageCardView), carried here so both views
  // can share one row shape built once in page.tsx.
  invoiced: boolean
  quantDone: boolean
  // Who last saved this lot's FINAL quant sheet, and when — from
  // lot_quotes.last_edited_by/last_edited_at (is_estimated = false).
  // Admin/supervisor-only column, see canSeeLastEdited.
  lastEditedAt: string | null
  lastEditedByInitials: string | null
}

export type TableExtraJobRow = {
  id: string
  title: string
  dueDate: string | null
  status: ExtraJobStatus
  delayed: boolean
  delayReason: string | null
  expectedCompletionDate: string | null
}

export type ChecklistColumn = { key: string; label: string; shortLabel: string }

// Display-only tweaks for the full Checklist view's column headers — labels,
// removals, and ordering here are specific to this table. They intentionally
// diverge from lib/checklist.ts's item labels (unchanged) and don't affect
// the lot detail page's checklist section (unchanged) or the Overview view
// (which has its own curated short labels and doesn't include these keys).
const CHECKLIST_VIEW_LABEL_OVERRIDES: Record<string, string> = {
  lw_tree_installed_pills: 'Tree installed',
  lw_irrigation_installed: 'Irrigation running',
  lw_plants_installed:     'Plants installed',
  lw_drippers_installed:   'Drippers installed',
  fin_mulch:                'Mulch installed',
  fin_general_clean:        'Site cleaned and swept',
  fin_quantity_survey:      'Quantity survey done',
}

const CHECKLIST_VIEW_HIDDEN_KEYS = new Set(['lw_planting_install_approved', 'fin_hardstand_clean'])

function applyChecklistViewOverrides(columns: ChecklistColumn[]): ChecklistColumn[] {
  const visible = columns
    .filter((c) => !CHECKLIST_VIEW_HIDDEN_KEYS.has(c.key))
    .map((c) => ({ ...c, shortLabel: CHECKLIST_VIEW_LABEL_OVERRIDES[c.key] ?? c.shortLabel }))

  // Mulch installed → right after Drippers installed.
  const mulchIdx = visible.findIndex((c) => c.key === 'fin_mulch')
  if (mulchIdx !== -1) {
    const [mulch] = visible.splice(mulchIdx, 1)
    const dripIdx = visible.findIndex((c) => c.key === 'lw_drippers_installed')
    visible.splice(dripIdx === -1 ? visible.length : dripIdx + 1, 0, mulch)
  }

  // Site cleaned and swept → right before Quantity survey done.
  const cleanIdx = visible.findIndex((c) => c.key === 'fin_general_clean')
  if (cleanIdx !== -1) {
    const [clean] = visible.splice(cleanIdx, 1)
    const qtyIdx = visible.findIndex((c) => c.key === 'fin_quantity_survey')
    visible.splice(qtyIdx === -1 ? visible.length : qtyIdx, 0, clean)
  }

  return visible
}

interface Props {
  lots: TableLotRow[]
  extraJobs: TableExtraJobRow[]
  checklistMap: Record<string, Record<string, boolean>>
  checklistColumns: ChecklistColumn[]
  view: 'overview' | 'checklist'
  siteId: string
  stageId: string
  canTickChecklist: boolean
  canToggleBuildComplete: boolean
  canSeeLastEdited: boolean
}

function TradeMark({ done }: { done: boolean }) {
  return (
    <span className={done ? 'text-green-600 dark:text-green-400' : 'text-fg-muted'}>
      {done ? '✓' : '✗'}
    </span>
  )
}

// No existing relative-time helper elsewhere in this codebase — exported so
// StageCardView.tsx can show the same last-edited indicator on lot cards.
// Falls back to a short date beyond a week, reusing lib/lotStatus.ts's
// existing formatDateShort.
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDateShort(iso.slice(0, 10))
}

export default function StageLotsTable({
  lots, extraJobs, checklistMap, checklistColumns, view, siteId, stageId,
  canTickChecklist, canToggleBuildComplete, canSeeLastEdited,
}: Props) {
  const displayColumns = view === 'checklist' ? applyChecklistViewOverrides(checklistColumns) : checklistColumns

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
            <th className="text-left font-medium px-2 py-2 whitespace-nowrap">Home Design</th>
            <th className="text-left font-medium px-2 py-2 whitespace-nowrap">Due date</th>
            <th className="text-left font-medium px-2 py-2 whitespace-nowrap">Status</th>
            <th className="text-left font-medium px-2 py-2 whitespace-nowrap">Delayed</th>
            <th className="text-center font-medium px-2 py-2 whitespace-nowrap">Fencer</th>
            <th className="text-center font-medium px-2 py-2 whitespace-nowrap">Concreter</th>
            {displayColumns.map((col) => (
              <th key={col.key} title={col.label} className="text-center font-medium px-2 py-2 whitespace-nowrap">
                {col.shortLabel}
              </th>
            ))}
            <th className="text-center font-medium px-2 py-2 whitespace-nowrap">Build Complete</th>
            {canSeeLastEdited && (
              <th className="text-left font-medium px-2 py-2 whitespace-nowrap">Last edited</th>
            )}
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
                <td className="px-2 py-2 whitespace-nowrap text-fg-secondary">{lot.homeDesign || <span className="text-fg-muted">—</span>}</td>
                <td className="px-2 py-2 whitespace-nowrap text-fg-muted">{formatDate(lot.dueDate)}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {lot.delayed && (
                    <span title={lot.delayReason ?? undefined} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${DELAYED_BADGE_CLASS}`}>
                      {delayedBadgeLabel(lot.expectedCompletionDate)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center"><TradeMark done={lot.tradesCompleted.includes('Fencer')} /></td>
                <td className="px-2 py-2 text-center"><TradeMark done={lot.tradesCompleted.includes('Concreter')} /></td>
                {displayColumns.map((col) => (
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
                {canSeeLastEdited && (
                  <td className="px-2 py-2 whitespace-nowrap text-fg-muted">
                    {lot.lastEditedAt && lot.lastEditedByInitials
                      ? `${lot.lastEditedByInitials} · ${formatRelativeTime(lot.lastEditedAt)}`
                      : null}
                  </td>
                )}
              </tr>
            )
          })}

          {extraJobs.length > 0 && (
            <tr className="border-b border-border bg-surface-raised">
              <td colSpan={(canSeeLastEdited ? 9 : 8) + displayColumns.length} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                Extra jobs
              </td>
            </tr>
          )}
          {extraJobs.map((job) => {
            const cfg = EXTRA_JOB_STATUS_CONFIG[job.status] ?? EXTRA_JOB_STATUS_CONFIG.not_started
            return (
              <tr key={job.id} className="border-b border-border-subtle hover:bg-surface-raised/60">
                <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-surface" colSpan={2}>
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
                      {delayedBadgeLabel(job.expectedCompletionDate)}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-center text-fg-muted" colSpan={2 + displayColumns.length}>—</td>
                <td className="px-2 py-2 text-center text-fg-muted">—</td>
                {canSeeLastEdited && <td className="px-2 py-2 text-center text-fg-muted">—</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
