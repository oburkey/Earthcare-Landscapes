'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type InvoiceRun = {
  id: string
  invoicedAt: string
  invoicedByName: string | null
  totalAmount: number | null
  notes: string | null
  lotCount: number
  extraJobCount: number
  progressClaimCount: number
  lotDetails: Array<{ lotNumber: string; siteName: string; stageName: string }>
  extraJobDetails: Array<{ title: string; siteName: string }>
  progressClaimDetails: Array<{ claimNumber: number; stageName: string; siteName: string; amount: number }>
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InvoiceHistory({ runs }: { runs: InvoiceRun[] }) {
  const [open, setOpen]               = useState(false)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  if (runs.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-raised transition-colors"
      >
        <svg className={`h-4 w-4 text-fg-muted shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        <span className="text-sm font-semibold text-fg flex-1">Invoice History</span>
        <span className="text-xs text-fg-muted shrink-0">{runs.length} run{runs.length !== 1 ? 's' : ''}</span>
      </button>

      {open && (
        <div className="border-t border-border-subtle divide-y divide-border-subtle">
          {runs.map((run) => {
            const isExpanded = expandedRun === run.id
            const itemCount  = run.lotCount + run.extraJobCount + run.progressClaimCount
            return (
              <div key={run.id}>
                <button
                  type="button"
                  onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-raised transition-colors"
                >
                  <svg className={`h-3.5 w-3.5 text-fg-muted shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                  <span className="text-sm font-medium text-fg-secondary flex-1 text-left">
                    {fmtDate(run.invoicedAt)}
                    {run.invoicedByName && <span className="text-fg-muted font-normal"> · by {run.invoicedByName}</span>}
                  </span>
                  <span className="text-xs text-fg-muted shrink-0 mx-3">
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </span>
                  {run.totalAmount != null && (
                    <span className="text-sm font-semibold text-fg shrink-0">{fmt(run.totalAmount)}</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3">
                    {run.notes && (
                      <p className="text-xs text-fg-muted italic">{run.notes}</p>
                    )}

                    {run.lotDetails.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-1.5">Lots</p>
                        <div className="space-y-1">
                          {run.lotDetails.map((lot, i) => (
                            <p key={i} className="text-sm text-fg-secondary">
                              Lot {lot.lotNumber}
                              <span className="text-fg-muted"> · {lot.siteName} · {lot.stageName}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {run.extraJobDetails.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-1.5">Extra Jobs</p>
                        <div className="space-y-1">
                          {run.extraJobDetails.map((job, i) => (
                            <p key={i} className="text-sm text-fg-secondary">
                              {job.title}
                              <span className="text-fg-muted"> · {job.siteName}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {run.progressClaimDetails.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-1.5">Progress Claims</p>
                        <div className="space-y-1">
                          {run.progressClaimDetails.map((claim, i) => (
                            <p key={i} className="text-sm text-fg-secondary">
                              Claim #{claim.claimNumber} — {fmt(claim.amount)}
                              <span className="text-fg-muted"> · {claim.siteName} · {claim.stageName}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
