'use client'

import { useState, useTransition } from 'react'
import { useActionState } from 'react'
import {
  deleteInvoiceRun, getInvoiceSnapshotDataUrl,
  getClaimLotDataForSnapshot, getClaimExtraJobData,
} from './actions'
import {
  generateClaimPdfBlob, pdfFilename,
  generateExtraJobPdfBlob, extraJobPdfFilename,
  downloadDataUrl, downloadBlob,
} from './pdfClient'

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
  lotDetails: Array<{ id: string; lotNumber: string; siteName: string; stageName: string }>
  extraJobDetails: Array<{ id: string; title: string; siteName: string }>
  progressClaimDetails: Array<{ claimNumber: number; stageName: string; siteName: string; amount: number }>
  snapshotPaths: Record<string, string>
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function confirmMessage(run: InvoiceRun): string {
  const parts: string[] = []
  if (run.lotCount > 0) parts.push(`${run.lotCount} lot${run.lotCount === 1 ? '' : 's'}`)
  if (run.extraJobCount > 0) parts.push(`${run.extraJobCount} extra job${run.extraJobCount === 1 ? '' : 's'}`)
  if (run.progressClaimCount > 0) parts.push(`${run.progressClaimCount} progress claim${run.progressClaimCount === 1 ? '' : 's'}`)
  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0] ?? 'these items'
  return `Delete this invoice run? This will unmark ${list} as invoiced and return them to approved status.`
}

// ── Delete ────────────────────────────────────────────────────────────────────

function DeleteRunButton({ run }: { run: InvoiceRun }) {
  const [confirming, setConfirming] = useState(false)
  const [state, action, pending] = useActionState(deleteInvoiceRun, null)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
        className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700"
      >
        Delete
      </button>
    )
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col items-end gap-1.5 shrink-0"
    >
      <p className="max-w-xs text-right text-xs text-fg-muted">{confirmMessage(run)}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs font-medium text-fg-muted hover:text-fg-secondary"
        >
          Cancel
        </button>
        <form action={action}>
          <input type="hidden" name="run_id" value={run.id} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Deleting…' : 'Yes, delete'}
          </button>
        </form>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  )
}

// ── Download PDF (per lot / extra job) ────────────────────────────────────────

type RegenerateResult = { blob: Blob; filename: string } | { error: string }

// Generic historical-snapshot download button: if a snapshot path exists,
// fetch it from R2 as-is; otherwise fall back to regenerating from current
// data (with a note, since that's no longer the historical version).
function DownloadSnapshotButton({
  snapshotPath, historicalFilename, regenerate,
}: {
  snapshotPath: string | undefined
  historicalFilename: string
  regenerate: () => Promise<RegenerateResult>
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote]   = useState<string | null>(null)

  function handleClick() {
    setError(null)
    setNote(null)
    startTransition(async () => {
      if (snapshotPath) {
        const result = await getInvoiceSnapshotDataUrl(snapshotPath)
        if (result.error || !result.dataUrl) {
          setError(result.error ?? 'Snapshot not found.')
          return
        }
        await downloadDataUrl(result.dataUrl, historicalFilename)
        return
      }

      // No snapshot on file (invoiced before this feature existed) — rebuild
      // from current data instead.
      const result = await regenerate()
      if ('error' in result) {
        setError(result.error)
        return
      }
      downloadBlob(result.blob, result.filename)
      setNote('Historical PDF not available — showing current data')
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="text-xs font-medium text-accent-fg hover:underline disabled:opacity-50"
      >
        {pending ? 'Preparing…' : 'Download PDF'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {note && <span className="text-xs text-amber-600 dark:text-amber-400">{note}</span>}
    </span>
  )
}

async function regenerateLotPdf(lotId: string): Promise<RegenerateResult> {
  const result = await getClaimLotDataForSnapshot(lotId)
  if (result.error || !result.data) return { error: result.error ?? 'Unable to generate PDF.' }
  const blob = await generateClaimPdfBlob(result.data)
  return { blob, filename: pdfFilename(result.data) }
}

async function regenerateExtraJobPdf(extraJobId: string): Promise<RegenerateResult> {
  const result = await getClaimExtraJobData(extraJobId)
  if (result.error || !result.data) return { error: result.error ?? 'Unable to generate PDF.' }
  const blob = await generateExtraJobPdfBlob(result.data)
  return { blob, filename: extraJobPdfFilename(result.data) }
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
                            <div key={i} className="flex items-center justify-between gap-3">
                              <p className="text-sm text-fg-secondary">
                                Lot {lot.lotNumber}
                                <span className="text-fg-muted"> · {lot.siteName} · {lot.stageName}</span>
                              </p>
                              <DownloadSnapshotButton
                                snapshotPath={run.snapshotPaths[lot.id]}
                                historicalFilename={`Lot-${lot.lotNumber}-Claim.pdf`}
                                regenerate={() => regenerateLotPdf(lot.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {run.extraJobDetails.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-1.5">Extra Jobs</p>
                        <div className="space-y-1">
                          {run.extraJobDetails.map((job, i) => (
                            <div key={i} className="flex items-center justify-between gap-3">
                              <p className="text-sm text-fg-secondary">
                                {job.title}
                                <span className="text-fg-muted"> · {job.siteName}</span>
                              </p>
                              <DownloadSnapshotButton
                                snapshotPath={run.snapshotPaths[job.id]}
                                historicalFilename={`ExtraJob-${job.title}-Claim.pdf`}
                                regenerate={() => regenerateExtraJobPdf(job.id)}
                              />
                            </div>
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

                    <div className="flex justify-end pt-2 border-t border-border-subtle">
                      <DeleteRunButton run={run} />
                    </div>
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
