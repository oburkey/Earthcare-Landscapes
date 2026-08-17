'use client'

import { useState } from 'react'
import MaterialsAccuracySection from './MaterialsAccuracySection'
import VarianceTrendChart from './VarianceTrendChart'
import type { MaterialsSection, MaterialsSiteOption } from '../lib'

// Carries the full parent chain at every level so a target site/stage can be
// derived at any selection depth without a separate lookup (needed by
// AnalyticsView to auto-expand the drill-down section below).
export type Selection =
  | { type: 'all' }
  | { type: 'site'; siteId: string }
  | { type: 'stage'; siteId: string; stageId: string }
  | { type: 'lot'; siteId: string; stageId: string; lotId: string }

interface Props {
  global: MaterialsSection
  bySite: Record<string, MaterialsSection>
  byStage: Record<string, MaterialsSection>
  byLot: Record<string, MaterialsSection>
  siteIndex: MaterialsSiteOption[]
  selection: Selection
  onSelectionChange: (selection: Selection) => void
  isAdmin: boolean
}

export default function MaterialsAccuracyPanel({
  global, bySite, byStage, byLot, siteIndex, selection, onSelectionChange, isAdmin,
}: Props) {
  // Which site's stage-list, and which stage's lot-list, are visually open —
  // independent of `selection` (e.g. selecting a stage auto-opens its lot
  // list, but a user can still collapse/re-expand without changing the
  // filter).
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null)
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null)

  const active =
    selection.type === 'all'   ? global :
    selection.type === 'site'  ? (bySite[selection.siteId] ?? global) :
    selection.type === 'stage' ? (byStage[selection.stageId] ?? global) :
    (byLot[selection.lotId] ?? global)

  function findSite(siteId: string) {
    return siteIndex.find((s) => s.id === siteId)
  }
  function findStage(siteId: string, stageId: string) {
    return findSite(siteId)?.stages.find((st) => st.id === stageId)
  }

  const breadcrumb = (() => {
    if (selection.type === 'all') return 'All Sites'
    const site = findSite(selection.siteId)
    const siteName = site?.name ?? 'Site'
    if (selection.type === 'site') return siteName
    const stage = findStage(selection.siteId, selection.stageId)
    const stageName = stage?.name ?? 'Stage'
    if (selection.type === 'stage') return `${siteName} · ${stageName}`
    const lot = stage?.lots.find((l) => l.id === selection.lotId)
    return `${siteName} · ${stageName} · Lot ${lot?.lotNumber ?? '?'}`
  })()

  function selectSite(siteId: string) {
    onSelectionChange({ type: 'site', siteId })
    setExpandedSiteId((prev) => (prev === siteId ? prev : siteId))
    setExpandedStageId(null)
  }
  function selectStage(siteId: string, stageId: string) {
    onSelectionChange({ type: 'stage', siteId, stageId })
    setExpandedStageId((prev) => (prev === stageId ? prev : stageId))
  }
  function selectLot(siteId: string, stageId: string, lotId: string) {
    onSelectionChange({ type: 'lot', siteId, stageId, lotId })
  }
  function toggleSiteExpand(siteId: string) {
    setExpandedSiteId((prev) => (prev === siteId ? null : siteId))
    setExpandedStageId(null)
  }
  function toggleStageExpand(stageId: string) {
    setExpandedStageId((prev) => (prev === stageId ? null : stageId))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-4 min-w-0">
        <p className="text-xs font-medium text-fg-muted">Materials accuracy — {breadcrumb}</p>
        <MaterialsAccuracySection materials={active} isAdmin={isAdmin} />
        <VarianceTrendChart trend={active.trend} />
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden h-fit lg:sticky lg:top-4">
        <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted border-b border-border-subtle">
          Filter
        </p>

        <button
          type="button"
          onClick={() => onSelectionChange({ type: 'all' })}
          className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
            selection.type === 'all'
              ? 'bg-green-700 text-white'
              : 'text-fg-secondary hover:bg-surface-raised'
          }`}
        >
          All Sites
        </button>

        <div className="border-t border-border-subtle divide-y divide-border-subtle">
          {siteIndex.map((site) => {
            const isSiteExpanded = expandedSiteId === site.id
            const siteSelected = selection.type === 'site' && selection.siteId === site.id
            return (
              <div key={site.id}>
                <div className={`flex items-center ${siteSelected ? 'bg-green-700' : ''}`}>
                  <button
                    type="button"
                    onClick={() => selectSite(site.id)}
                    className={`flex-1 flex items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors truncate ${
                      siteSelected ? 'text-white' : 'text-fg-secondary hover:bg-surface-raised'
                    }`}
                  >
                    <span className="flex-1 truncate">{site.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSiteExpand(site.id)}
                    aria-label={isSiteExpanded ? 'Collapse stages' : 'Expand stages'}
                    className={`shrink-0 px-3 py-3 ${siteSelected ? 'text-white' : 'text-fg-muted hover:bg-surface-raised'}`}
                  >
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${isSiteExpanded ? '' : '-rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>

                {isSiteExpanded && (
                  site.stages.length === 0 ? (
                    <p className="px-4 py-2 pl-8 text-xs text-fg-muted">No stages</p>
                  ) : (
                    <div className="divide-y divide-border-subtle">
                      {site.stages.map((stage) => {
                        const isStageExpanded = expandedStageId === stage.id
                        const stageSelected = selection.type === 'stage' && selection.stageId === stage.id
                        return (
                          <div key={stage.id}>
                            <div className={`flex items-center ${stageSelected ? 'bg-green-700' : ''}`}>
                              <button
                                type="button"
                                onClick={() => selectStage(site.id, stage.id)}
                                className={`flex-1 py-2 pl-8 pr-2 text-left text-xs font-medium transition-colors truncate ${
                                  stageSelected ? 'text-white' : 'text-fg-muted hover:bg-surface-raised'
                                }`}
                              >
                                {stage.name}
                              </button>
                              {stage.lots.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleStageExpand(stage.id)}
                                  aria-label={isStageExpanded ? 'Collapse lots' : 'Expand lots'}
                                  className={`shrink-0 px-2 py-2 ${stageSelected ? 'text-white' : 'text-fg-muted hover:bg-surface-raised'}`}
                                >
                                  <svg
                                    className={`h-3 w-3 transition-transform ${isStageExpanded ? '' : '-rotate-90'}`}
                                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {isStageExpanded && stage.lots.length > 0 && (
                              <div className="divide-y divide-border-subtle">
                                {stage.lots.map((lot) => {
                                  const lotSelected = selection.type === 'lot' && selection.lotId === lot.id
                                  return (
                                    <button
                                      key={lot.id}
                                      type="button"
                                      onClick={() => selectLot(site.id, stage.id, lot.id)}
                                      className={`block w-full py-1.5 pl-14 pr-4 text-left text-xs font-medium transition-colors truncate ${
                                        lotSelected
                                          ? 'bg-green-700 text-white'
                                          : 'text-fg-muted hover:bg-surface-raised'
                                      }`}
                                    >
                                      Lot {lot.lotNumber}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
