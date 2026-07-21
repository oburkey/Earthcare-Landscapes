'use client'

import { useState } from 'react'
import MaterialsAccuracySection from './MaterialsAccuracySection'
import VarianceTrendChart from './VarianceTrendChart'
import type { MaterialsSection, MaterialsSiteOption } from '../lib'

type Selection = { type: 'all' } | { type: 'stage'; id: string }

interface Props {
  global: MaterialsSection
  bySite: Record<string, MaterialsSection>
  byStage: Record<string, MaterialsSection>
  siteIndex: MaterialsSiteOption[]
}

export default function MaterialsAccuracyPanel({ global, byStage, siteIndex }: Props) {
  const [selection, setSelection] = useState<Selection>({ type: 'all' })
  // Accordion: at most one site expanded at a time.
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null)

  const active = selection.type === 'all' ? global : (byStage[selection.id] ?? global)

  function stageLabel(stageId: string): string {
    for (const site of siteIndex) {
      const stage = site.stages.find((st) => st.id === stageId)
      if (stage) return `${site.name} / ${stage.name}`
    }
    return 'Stage'
  }

  const activeLabel = selection.type === 'all' ? 'All Sites' : stageLabel(selection.id)

  function toggleSite(siteId: string) {
    setExpandedSiteId((prev) => (prev === siteId ? null : siteId))
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="space-y-4 min-w-0">
        <p className="text-xs font-medium text-fg-muted">Showing: {activeLabel}</p>
        <MaterialsAccuracySection materials={active} />
        <VarianceTrendChart trend={active.trend} />
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden h-fit lg:sticky lg:top-4">
        <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-muted border-b border-border-subtle">
          Filter
        </p>

        <button
          type="button"
          onClick={() => setSelection({ type: 'all' })}
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
            const isExpanded = expandedSiteId === site.id
            return (
              <div key={site.id}>
                <button
                  type="button"
                  onClick={() => toggleSite(site.id)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
                >
                  <svg
                    className={`h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                  <span className="flex-1 truncate">{site.name}</span>
                </button>

                {isExpanded && (
                  site.stages.length === 0 ? (
                    <p className="px-4 py-2 pl-10 text-xs text-fg-muted">No stages</p>
                  ) : (
                    <div className="divide-y divide-border-subtle">
                      {site.stages.map((stage) => {
                        const stageSelected = selection.type === 'stage' && selection.id === stage.id
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => setSelection({ type: 'stage', id: stage.id })}
                            className={`block w-full py-2 pl-10 pr-4 text-left text-xs font-medium transition-colors ${
                              stageSelected
                                ? 'bg-green-700 text-white'
                                : 'text-fg-muted hover:bg-surface-raised'
                            }`}
                          >
                            {stage.name}
                          </button>
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
