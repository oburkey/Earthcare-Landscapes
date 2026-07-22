'use client'

import { useState } from 'react'
import { fmtCurrency, fmtDate, fmtNumber, fmtPct } from '../format'
import type { LotDrillDownRow, SiteAnalytics, StageAnalytics } from '../lib'

function MarginText({ margin, marginPct }: { margin: number; marginPct: number | null }) {
  return (
    <span className={margin >= 0 ? 'text-green-700' : 'text-red-600'}>
      {fmtCurrency(margin)}
      {marginPct != null && <span className="ml-1 text-fg-muted">({fmtPct(marginPct, 0)})</span>}
    </span>
  )
}

// ── Quote-based lot row (Providence-style) — final price + variance detail ────

function LotRow({ lot }: { lot: LotDrillDownRow }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!lot.varianceCategories && lot.varianceCategories.length > 0

  return (
    <>
      <tr className="border-t border-border-subtle">
        <td className="px-4 py-2 text-fg-secondary">{lot.lotNumber}</td>
        <td className="px-2 py-2 text-fg-muted">{lot.homeDesign || '—'}</td>
        <td className="px-2 py-2 text-fg-muted">{fmtDate(lot.dueDate)}</td>
        <td className="px-2 py-2 text-fg-muted">{lot.buildComplete ? 'Complete' : 'In progress'}</td>
        <td className="px-2 py-2 text-fg-muted">{lot.invoiced ? 'Yes' : 'No'}</td>
        <td className="px-2 py-2 pr-4 text-right">
          {lot.finalTotal !== null ? (
            <span className="font-medium text-fg-secondary">{fmtCurrency(lot.finalTotal)}</span>
          ) : lot.estimateOnlyTotal !== null ? (
            <span className="text-fg-muted">
              <span className="mr-1 rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Est.</span>
              {fmtCurrency(lot.estimateOnlyTotal)}
            </span>
          ) : (
            <span className="text-fg-muted">—</span>
          )}
        </td>
        <td className="w-8 px-2 py-2">
          {hasDetail && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Hide material variance' : 'Show material variance'}
              className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:bg-surface-raised"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr className="border-t border-border-subtle bg-surface-raised/50">
          <td colSpan={7} className="px-4 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              Estimate vs final material variance
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {lot.varianceCategories!.map((c) => (
                <span key={c.key} className="text-xs text-fg-muted">
                  {c.label} <span className="font-medium text-fg-secondary">{fmtPct(c.pct, 0)}</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── NLV / contract-priced lot row — contract price, subbie cost, margin ───────

function NlvLotRow({ lot }: { lot: LotDrillDownRow }) {
  const [expanded, setExpanded] = useState(false)
  const hasBreakdown = lot.subcontractorBreakdown.length > 0

  return (
    <>
      <tr className="border-t border-border-subtle">
        <td className="px-4 py-2 text-fg-secondary">{lot.lotNumber}</td>
        <td className="px-2 py-2 text-fg-muted">{lot.homeDesign || '—'}</td>
        <td className="px-2 py-2 text-fg-muted">{fmtDate(lot.dueDate)}</td>
        <td className="px-2 py-2 text-fg-muted">{lot.buildComplete ? 'Complete' : 'In progress'}</td>
        <td className="px-2 py-2 text-fg-muted">{lot.invoiced ? 'Yes' : 'No'}</td>
        <td className="px-2 py-2 text-right text-fg-secondary">
          {lot.contractPrice !== null ? fmtCurrency(lot.contractPrice) : '—'}
        </td>
        <td className="px-2 py-2 text-right text-fg-muted">
          {lot.subcontractorCost > 0 ? fmtCurrency(lot.subcontractorCost) : '—'}
        </td>
        <td className="px-2 py-2 pr-4 text-right">
          {lot.margin !== null ? <MarginText margin={lot.margin} marginPct={lot.marginPct} /> : <span className="text-fg-muted">—</span>}
        </td>
        <td className="w-8 px-2 py-2">
          {hasBreakdown && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Hide subcontractor costs' : 'Show subcontractor costs'}
              className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:bg-surface-raised"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
        </td>
      </tr>
      {expanded && hasBreakdown && (
        <tr className="border-t border-border-subtle bg-surface-raised/50">
          <td colSpan={9} className="px-4 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              Subcontractor costs
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {lot.subcontractorBreakdown.map((s, i) => (
                <span key={i} className="text-xs text-fg-muted">
                  {s.label} <span className="font-medium text-fg-secondary">{fmtCurrency(s.amount)}</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function StageRow({ stage }: { stage: StageAnalytics }) {
  const [expanded, setExpanded] = useState(false)
  const { summary } = stage
  const nlv = summary.nlv

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
            {!stage.isContractPricing && summary.revenue.total > 0 && <> · {fmtCurrency(summary.revenue.total)}</>}
          </p>
          {stage.isContractPricing && nlv.contractValue > 0 && (
            <p className="mt-1 text-xs text-fg-muted">
              Contract {fmtCurrency(nlv.contractValue)} · Subcontractors {fmtCurrency(nlv.subcontractorCost)} · Margin{' '}
              <MarginText margin={nlv.margin} marginPct={nlv.marginPct} />
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium text-fg-muted">{expanded ? 'Hide' : 'Show'} lots</span>
      </button>

      {expanded && (
        <div className="border-t border-border-subtle overflow-x-auto">
          {stage.lots.length === 0 ? (
            <p className="px-4 py-3 text-sm text-fg-muted">No lots in this range.</p>
          ) : stage.isContractPricing ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-fg-muted">
                  <th className="text-left font-medium px-4 py-2">Lot</th>
                  <th className="text-left font-medium px-2 py-2">Home Design</th>
                  <th className="text-left font-medium px-2 py-2">Due date</th>
                  <th className="text-left font-medium px-2 py-2">Build</th>
                  <th className="text-left font-medium px-2 py-2">Invoiced</th>
                  <th className="text-right font-medium px-2 py-2">Contract price</th>
                  <th className="text-right font-medium px-2 py-2">Subcontractor cost</th>
                  <th className="text-right font-medium px-2 py-2 pr-4">Margin</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {stage.lots.map((lot) => (
                  <NlvLotRow key={lot.id} lot={lot} />
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-fg-muted">
                  <th className="text-left font-medium px-4 py-2">Lot</th>
                  <th className="text-left font-medium px-2 py-2">Home Design</th>
                  <th className="text-left font-medium px-2 py-2">Due date</th>
                  <th className="text-left font-medium px-2 py-2">Build</th>
                  <th className="text-left font-medium px-2 py-2">Invoiced</th>
                  <th className="text-right font-medium px-2 py-2 pr-4">Final price</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {stage.lots.map((lot) => (
                  <LotRow key={lot.id} lot={lot} />
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
  const siteNlv = activeSite.summary.nlv

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
        {siteNlv.contractValue > 0 && (
          <p className="mt-1 text-sm text-fg-secondary">
            Contract value {fmtCurrency(siteNlv.contractValue)} · Subcontractor costs {fmtCurrency(siteNlv.subcontractorCost)} · Margin{' '}
            <MarginText margin={siteNlv.margin} marginPct={siteNlv.marginPct} />
          </p>
        )}
      </div>

      <div className="space-y-2">
        {activeSite.stages.map((stage) => (
          <StageRow key={stage.id} stage={stage} />
        ))}
      </div>
    </div>
  )
}
