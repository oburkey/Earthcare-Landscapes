'use client'

import { useState } from 'react'
import { fmtCurrency, fmtDate, fmtNumber } from '../format'
import type { SiteAnalytics, StageAnalytics } from '../lib'

function StageRow({ stage }: { stage: StageAnalytics }) {
  const [expanded, setExpanded] = useState(false)
  const { summary } = stage

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-fg-secondary">{stage.name}</p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {summary.lotCount} lot{summary.lotCount === 1 ? '' : 's'} · {fmtNumber(summary.completionPct, 0)}% complete
            {summary.revenue.total > 0 && <> · {fmtCurrency(summary.revenue.total)}</>}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-fg-muted">{expanded ? 'Hide' : 'Show'} lots</span>
      </button>

      {expanded && (
        <div className="border-t border-border-subtle overflow-x-auto">
          {stage.lots.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fg-muted">No lots in this range.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-fg-muted">
                  <th className="text-left font-medium px-4 py-2">Lot</th>
                  <th className="text-left font-medium px-2 py-2">Due date</th>
                  <th className="text-left font-medium px-2 py-2">Build</th>
                  <th className="text-left font-medium px-2 py-2">Invoiced</th>
                  <th className="text-left font-medium px-2 py-2 pr-4">Estimate vs final variance</th>
                </tr>
              </thead>
              <tbody>
                {stage.lots.map((lot) => (
                  <tr key={lot.id} className="border-t border-border-subtle">
                    <td className="px-4 py-2 text-fg-secondary">{lot.lotNumber}</td>
                    <td className="px-2 py-2 text-fg-muted">{fmtDate(lot.dueDate)}</td>
                    <td className="px-2 py-2 text-fg-muted">{lot.buildComplete ? 'Complete' : 'In progress'}</td>
                    <td className="px-2 py-2 text-fg-muted">{lot.invoiced ? 'Yes' : 'No'}</td>
                    <td className="px-2 py-2 pr-4 text-fg-muted">
                      {lot.varianceSummary
                        ?? (lot.estimateOnlyTotal !== null ? `Est. ${fmtCurrency(lot.estimateOnlyTotal)}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default function DrillDownSection({ sites }: { sites: SiteAnalytics[] }) {
  const [activeSiteId, setActiveSiteId] = useState<string | null>(sites[0]?.id ?? null)

  if (sites.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-fg-muted">No lots due in this range.</p>
      </div>
    )
  }

  const activeSite = sites.find((s) => s.id === activeSiteId) ?? sites[0]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {sites.map((site) => (
          <button
            key={site.id}
            type="button"
            onClick={() => setActiveSiteId(site.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeSite.id === site.id
                ? 'bg-green-700 text-white'
                : 'text-fg-muted hover:bg-surface-raised'
            }`}
          >
            {site.name}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-medium text-fg-muted">{activeSite.name} — overview</p>
        <p className="mt-1 text-sm text-fg-secondary">
          {activeSite.summary.lotCount} lot{activeSite.summary.lotCount === 1 ? '' : 's'} ·{' '}
          {fmtNumber(activeSite.summary.completionPct, 0)}% complete
          {activeSite.summary.revenue.total > 0 && <> · {fmtCurrency(activeSite.summary.revenue.total)} revenue</>}
        </p>
      </div>

      <div className="space-y-2">
        {activeSite.stages.map((stage) => (
          <StageRow key={stage.id} stage={stage} />
        ))}
      </div>
    </div>
  )
}
