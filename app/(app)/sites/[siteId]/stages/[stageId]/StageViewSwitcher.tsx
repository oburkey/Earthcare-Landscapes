'use client'

import { useState } from 'react'
import { CHECKLIST_SECTIONS } from '@/lib/checklist'
import StageCardView from './StageCardView'
import StageLotsTable, { type TableLotRow, type TableExtraJobRow, type ChecklistColumn } from './StageLotsTable'
import type { TradeStatusSummary } from '@/lib/lotStatus'

const STORAGE_KEY = 'stage-view-preference'
type View = 'overview' | 'checklist' | 'cards'
const VALID_VIEWS: View[] = ['overview', 'checklist', 'cards']

// Overview = a curated subset of the checklist most people check day to day.
// Short labels are the user-facing column headers; full labels show on hover.
const OVERVIEW_KEYS: { key: string; shortLabel: string }[] = [
  { key: 'lw_edging_installed',   shortLabel: 'Edging' },
  { key: 'lw_turf_installed',     shortLabel: 'Turf' },
  { key: 'lw_steppers_installed', shortLabel: 'Steppers' },
  { key: 'lw_plants_installed',   shortLabel: 'Plants' },
  { key: 'fin_mulch',             shortLabel: 'Mulch' },
  { key: 'fin_retic_timer_set',   shortLabel: 'Retic Timer' },
  { key: 'fin_quantity_survey',   shortLabel: 'Quant Survey' },
]

const ALL_ITEMS = CHECKLIST_SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, sectionId: s.id })))

function shortenLabel(label: string): string {
  // Trim the long descriptive labels down to something a narrow column can hold.
  return label.split(/[—,(]/)[0].replace(/\binstalled\b/i, '').trim() || label
}

const OVERVIEW_COLUMNS: ChecklistColumn[] = OVERVIEW_KEYS.map(({ key, shortLabel }) => {
  const item = ALL_ITEMS.find((i) => i.key === key)
  return { key, label: item?.label ?? key, shortLabel }
})

// Full Landscaping Works + Finishing sections, in order — Pre-Checks excluded
// since those aren't part of the day-to-day ticking flow.
const CHECKLIST_COLUMNS: ChecklistColumn[] = CHECKLIST_SECTIONS
  .filter((s) => s.id === 'landscaping_works' || s.id === 'finishing')
  .flatMap((s) => s.items)
  .map((item) => ({ key: item.key, label: item.label, shortLabel: shortenLabel(item.label) }))

interface Props {
  lots: TableLotRow[]
  extraJobs: TableExtraJobRow[]
  tradeStatusMap: Record<string, TradeStatusSummary>
  checklistMap: Record<string, Record<string, boolean>>
  siteId: string
  stageId: string
  canAddLot: boolean
  canManageExtraJobs: boolean
  canTickChecklist: boolean
  canToggleBuildComplete: boolean
  // Gates Overview/Checklist table views — see the comment on
  // canUseStageTableViews in page.tsx to change who this applies to.
  canUseTableViews: boolean
  // Gates the "last edited" quant-sheet indicator column in the table view —
  // supervisor+ (admin included, since supervisor is already the higher of
  // the two roles this needs to cover).
  canSeeLastEdited: boolean
}

export default function StageViewSwitcher({
  lots, extraJobs, tradeStatusMap, checklistMap, siteId, stageId,
  canAddLot, canManageExtraJobs, canTickChecklist, canToggleBuildComplete, canUseTableViews, canSeeLastEdited,
}: Props) {
  // Lazy initializer (same pattern as ScheduleView's view-preference state) —
  // localStorage isn't available during SSR, so fall back to the default there.
  // Roles without table-view access always see Cards, regardless of any
  // previously saved preference (e.g. from before the gate was added, or a
  // shared/reused browser profile).
  const [view, setView] = useState<View>(() => {
    if (!canUseTableViews) return 'cards'
    if (typeof window === 'undefined') return 'overview'
    const saved = localStorage.getItem(STORAGE_KEY)
    return (saved && VALID_VIEWS.includes(saved as View)) ? saved as View : 'overview'
  })

  function changeView(v: View) {
    setView(v)
    localStorage.setItem(STORAGE_KEY, v)
  }

  const views: { id: View; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'cards',     label: 'Cards' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-fg-secondary">Lots</h2>
        {canUseTableViews && (
          <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => changeView(v.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v.id
                    ? 'bg-green-700 text-white'
                    : 'text-fg-muted hover:bg-surface-raised'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'cards' ? (
        <StageCardView
          lots={lots}
          extraJobs={extraJobs}
          tradeStatusMap={tradeStatusMap}
          siteId={siteId}
          stageId={stageId}
          canAddLot={canAddLot}
          canManageExtraJobs={canManageExtraJobs}
          canSeeLastEdited={canSeeLastEdited}
        />
      ) : (
        <StageLotsTable
          lots={lots}
          extraJobs={extraJobs}
          checklistMap={checklistMap}
          checklistColumns={view === 'overview' ? OVERVIEW_COLUMNS : CHECKLIST_COLUMNS}
          view={view}
          siteId={siteId}
          stageId={stageId}
          canTickChecklist={canTickChecklist}
          canToggleBuildComplete={canToggleBuildComplete}
          canSeeLastEdited={canSeeLastEdited}
        />
      )}
    </div>
  )
}
