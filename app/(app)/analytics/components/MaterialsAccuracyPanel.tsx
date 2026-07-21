'use client'

import { useState } from 'react'
import MaterialsAccuracySection from './MaterialsAccuracySection'
import VarianceTrendChart from './VarianceTrendChart'
import type { MaterialsSection, MaterialsSiteOption } from '../lib'

type Selection = { type: 'all' } | { type: 'site'; id: string } | { type: 'stage'; id: string }

interface Props {
  global: MaterialsSection
  bySite: Record<string, MaterialsSection>
  byStage: Record<string, MaterialsSection>
  siteIndex: MaterialsSiteOption[]
}

function selectionKey(s: Selection): string {
  return s.type === 'all' ? 'all' : `${s.type}:${s.id}`
}

export default function MaterialsAccuracyPanel({ global, bySite, byStage, siteIndex }: Props) {
  const [selection, setSelection] = useState<Selection>({ type: 'all' })

  const active =
    selection.type === 'all' ? global
    : selection.type === 'site' ? (bySite[selection.id] ?? global)
    : (byStage[selection.id] ?? global)

  function stageLabel(stageId: string): string {
    for (const site of siteIndex) {
      const stage = site.stages.find((st) => st.id === stageId)
      if (stage) return `${site.name} / ${stage.name}`
    }
    return 'Stage'
  }

  const activeLabel =
    selection.type === 'all' ? 'All sites'
    : selection.type === 'site' ? (siteIndex.find((s) => s.id === selection.id)?.name ?? 'Site')
    : stageLabel(selection.id)

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="space-y-4 min-w-0">
        <p className="text-xs font-medium text-fg-muted">Showing: {activeLabel}</p>
        <MaterialsAccuracySection materials={active} />
        <VarianceTrendChart trend={active.trend} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-2 h-fit lg:sticky lg:top-4">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">Filter</p>
        <nav className="space-y-0.5">
          <button
            type="button"
            onClick={() => setSelection({ type: 'all' })}
            className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
              selectionKey(selection) === 'all'
                ? 'bg-green-700 text-white'
                : 'text-fg-secondary hover:bg-surface-raised'
            }`}
          >
            All sites
          </button>

          {siteIndex.map((site) => (
            <div key={site.id}>
              <button
                type="button"
                onClick={() => setSelection({ type: 'site', id: site.id })}
                className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                  selectionKey(selection) === `site:${site.id}`
                    ? 'bg-green-700 text-white'
                    : 'text-fg-secondary hover:bg-surface-raised'
                }`}
              >
                {site.name}
              </button>
              {site.stages.length > 0 && (
                <div className="ml-3 space-y-0.5 border-l border-border-subtle pl-2">
                  {site.stages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setSelection({ type: 'stage', id: stage.id })}
                      className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                        selectionKey(selection) === `stage:${stage.id}`
                          ? 'bg-green-700 text-white'
                          : 'text-fg-muted hover:bg-surface-raised'
                      }`}
                    >
                      {stage.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}
