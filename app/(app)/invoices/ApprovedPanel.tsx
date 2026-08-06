'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { markAsInvoiced, uploadInvoiceSnapshot, getClaimExtraJobData } from './actions'
import { generateClaimPdfBlob, pdfFilename, generateExtraJobPdfBlob, extraJobPdfFilename, type ClaimLotData } from './pdfClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovedLot = ClaimLotData

export type ApprovedExtraJob = {
  id: string
  title: string
  siteName: string
  siteId: string
  stageId: string
  amount: number
  approvedByName: string | null
}

export type ApprovedProgressClaim = {
  id: string
  claimNumber: number
  stageName: string
  siteName: string
  amount: number
  percentage: number | null
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── PDF generation ────────────────────────────────────────────────────────────
// lotClaimHtml/CLAIM_STYLES/generateClaimPdfBlob live in ./pdfClient — shared
// with InvoiceHistory's "no snapshot" fallback so both places render the
// exact same claim sheet.

async function downloadZip(
  lots: ApprovedLot[],
  onError: (msg: string) => void,
  onDone: () => void
) {
  try {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (const lot of lots) {
      const blob = await generateClaimPdfBlob(lot)
      zip.file(pdfFilename(lot), blob)
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Claim-Sheets-${new Date().toISOString().slice(0, 10)}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    onError('Failed to generate ZIP. Please try again.')
  } finally {
    onDone()
  }
}

// Uploads an already-generated PDF blob to R2 under
// invoice-snapshots/{timestamp}/{entityKey}.pdf. entityKey is the lot ID for
// lots, or `extrajob_{extra_job_id}` for extra jobs — kept generic so both
// share the one upload action.
async function uploadSnapshot(entityKey: string, timestamp: string, blob: Blob, filename: string): Promise<string | null> {
  const fd = new FormData()
  fd.set('entity_key', entityKey)
  fd.set('timestamp', timestamp)
  fd.set('file', new File([blob], filename, { type: 'application/pdf' }))
  const result = await uploadInvoiceSnapshot(fd)
  return result.path ?? null
}

// Generates a claim sheet PDF for each lot/extra job being invoiced and
// uploads it to R2, so invoice history can later show exactly what was
// claimed at the moment of invoicing (the underlying pricing can keep
// changing after that). Best-effort: a failed snapshot doesn't block marking
// items as invoiced — the core business action must not be gated on a
// nice-to-have PDF archive.
async function uploadInvoiceSnapshots(
  lots: ApprovedLot[],
  jobs: ApprovedExtraJob[]
): Promise<{ paths: Record<string, string>; failedCount: number }> {
  const timestamp = Date.now().toString()
  const paths: Record<string, string> = {}
  let failedCount = 0

  for (const lot of lots) {
    try {
      const blob = await generateClaimPdfBlob(lot)
      const path = await uploadSnapshot(lot.id, timestamp, blob, pdfFilename(lot))
      if (path) paths[lot.id] = path
      else failedCount++
    } catch {
      failedCount++
    }
  }

  for (const job of jobs) {
    try {
      const result = await getClaimExtraJobData(job.id)
      if (!result.data) { failedCount++; continue }
      const blob = await generateExtraJobPdfBlob(result.data)
      const path = await uploadSnapshot(`extrajob_${job.id}`, timestamp, blob, extraJobPdfFilename(result.data))
      if (path) paths[job.id] = path
      else failedCount++
    } catch {
      failedCount++
    }
  }

  return { paths, failedCount }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApprovedPanel({
  lots,
  extraJobs,
  progressClaims,
}: {
  lots: ApprovedLot[]
  extraJobs: ApprovedExtraJob[]
  progressClaims: ApprovedProgressClaim[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedLotIds, setSelectedLotIds]         = useState<Set<string>>(() => new Set(lots.map((l) => l.id)))
  const [selectedJobIds, setSelectedJobIds]         = useState<Set<string>>(() => new Set(extraJobs.map((j) => j.id)))
  const [selectedClaimIds, setSelectedClaimIds]     = useState<Set<string>>(() => new Set(progressClaims.map((c) => c.id)))
  const [invoiceDate, setInvoiceDate]         = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes]                     = useState('')
  const [generating, setGenerating]           = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [warning, setWarning]                 = useState<string | null>(null)
  const [invoicingStep, setInvoicingStep]     = useState<'snapshots' | 'saving' | null>(null)
  const [isPending, startTransition]          = useTransition()
  const hasSelections = selectedLotIds.size > 0 || selectedJobIds.size > 0 || selectedClaimIds.size > 0

  // Keep selections in sync when props update (page refresh after invoicing)
  const prevLotIds = useRef(new Set(lots.map((l) => l.id)))
  useEffect(() => {
    const newIds = new Set(lots.map((l) => l.id))
    setSelectedLotIds((prev) => {
      const updated = new Set([...prev].filter((id) => newIds.has(id)))
      for (const id of newIds) {
        if (!prevLotIds.current.has(id)) updated.add(id)
      }
      return updated
    })
    prevLotIds.current = newIds
  }, [lots])

  // Warn before tab close/refresh if selections exist
  useEffect(() => {
    if (!hasSelections) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      return (e.returnValue = '')
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasSelections])

  const selectedLots   = lots.filter((l) => selectedLotIds.has(l.id))
  const selectedJobs   = extraJobs.filter((j) => selectedJobIds.has(j.id))
  const selectedClaims = progressClaims.filter((c) => selectedClaimIds.has(c.id))

  const runningTotal =
    selectedLots.reduce((s, l) => s + (l.contractPrice ?? (l.standardAmount + l.clientExtrasAmount)), 0) +
    selectedJobs.reduce((s, j) => s + j.amount, 0) +
    selectedClaims.reduce((s, c) => s + c.amount, 0)

  function handleMarkAsInvoiced() {
    setError(null)
    setWarning(null)
    startTransition(async () => {
      let snapshotPaths: Record<string, string> = {}
      if (selectedLots.length > 0 || selectedJobs.length > 0) {
        setInvoicingStep('snapshots')
        const result = await uploadInvoiceSnapshots(selectedLots, selectedJobs)
        snapshotPaths = result.paths
        if (result.failedCount > 0) {
          setWarning(
            `${result.failedCount} claim sheet snapshot${result.failedCount === 1 ? '' : 's'} failed to save — invoicing will continue.`
          )
        }
      }

      setInvoicingStep('saving')
      const fd = new FormData()
      fd.set('lot_ids',            [...selectedLotIds].join(','))
      fd.set('extra_job_ids',     [...selectedJobIds].join(','))
      fd.set('progress_claim_ids', [...selectedClaimIds].join(','))
      fd.set('total_amount', String(runningTotal))
      fd.set('invoice_date', new Date(invoiceDate + 'T00:00:00').toISOString())
      fd.set('notes',        notes)
      fd.set('snapshot_paths', JSON.stringify(snapshotPaths))
      const result = await markAsInvoiced(null, fd)
      setInvoicingStep(null)
      if (result?.error) {
        setError(result.error)
      } else {
        setSelectedLotIds(new Set())
        setSelectedJobIds(new Set())
        setSelectedClaimIds(new Set())
        router.refresh()
      }
    })
  }

  const total = lots.length + extraJobs.length + progressClaims.length
  if (total === 0) return null

  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-accent-dim overflow-hidden">

      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
      >
        <svg className={`h-4 w-4 text-accent-fg shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        <span className="text-sm font-semibold text-accent-fg flex-1">
          Approved for Invoicing
        </span>
        <span className="text-xs text-accent-fg font-medium shrink-0">
          {[
            lots.length > 0          ? `${lots.length} lot${lots.length !== 1 ? 's' : ''}` : null,
            extraJobs.length > 0     ? `${extraJobs.length} extra job${extraJobs.length !== 1 ? 's' : ''}` : null,
            progressClaims.length > 0 ? `${progressClaims.length} claim${progressClaims.length !== 1 ? 's' : ''}` : null,
          ].filter(Boolean).join(' · ')}
        </span>
      </button>

      {open && (
        <div className="border-t border-green-200 dark:border-green-800 px-5 pb-5 space-y-4">

          {/* Lots */}
          {lots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-accent-fg uppercase tracking-wide pt-4 mb-2">Lots</p>
              <div className="rounded-xl border border-green-200 dark:border-green-800 overflow-hidden divide-y divide-green-100 dark:divide-green-900">
                {lots.map((lot) => {
                  const amount  = lot.contractPrice ?? (lot.standardAmount + lot.clientExtrasAmount)
                  const checked = selectedLotIds.has(lot.id)
                  return (
                    <label
                      key={lot.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-green-50 dark:bg-green-900/20' : 'bg-surface hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedLotIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(lot.id)) next.delete(lot.id); else next.add(lot.id)
                          return next
                        })}
                        className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600 cursor-pointer shrink-0"
                      />
                      <span className="text-sm text-fg-secondary flex-1 min-w-0">
                        <span className="font-medium">Lot {lot.lotNumber}</span>
                        <span className="text-fg-muted"> · {lot.siteName} · {lot.stageName}</span>
                      </span>
                      <span className="text-sm tabular-nums font-medium text-fg-secondary shrink-0">{fmt(amount)}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Extra jobs */}
          {extraJobs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-accent-fg uppercase tracking-wide mb-2">Extra Jobs</p>
              <div className="rounded-xl border border-green-200 dark:border-green-800 overflow-hidden divide-y divide-green-100 dark:divide-green-900">
                {extraJobs.map((job) => {
                  const checked = selectedJobIds.has(job.id)
                  return (
                    <label
                      key={job.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-green-50 dark:bg-green-900/20' : 'bg-surface hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedJobIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(job.id)) next.delete(job.id); else next.add(job.id)
                          return next
                        })}
                        className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600 cursor-pointer shrink-0"
                      />
                      <span className="text-sm text-fg-secondary flex-1 min-w-0 truncate">
                        <span className="font-medium">{job.title}</span>
                        <span className="text-fg-muted"> · {job.siteName}</span>
                        {job.approvedByName && (
                          <span className="text-fg-muted"> · Approved by {job.approvedByName}</span>
                        )}
                      </span>
                      <span className="text-sm tabular-nums font-medium text-fg-secondary shrink-0">{fmt(job.amount)}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Progress claims */}
          {progressClaims.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-accent-fg uppercase tracking-wide mb-2">Progress Claims</p>
              <div className="rounded-xl border border-green-200 dark:border-green-800 overflow-hidden divide-y divide-green-100 dark:divide-green-900">
                {progressClaims.map((claim) => {
                  const checked = selectedClaimIds.has(claim.id)
                  return (
                    <label
                      key={claim.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-green-50 dark:bg-green-900/20' : 'bg-surface hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedClaimIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(claim.id)) next.delete(claim.id); else next.add(claim.id)
                          return next
                        })}
                        className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600 cursor-pointer shrink-0"
                      />
                      <span className="text-sm text-fg-secondary flex-1 min-w-0">
                        <span className="font-medium">Claim #{claim.claimNumber}</span>
                        <span className="text-fg-muted"> · {claim.siteName} · {claim.stageName}</span>
                        {claim.percentage != null && <span className="text-fg-muted"> · {claim.percentage}%</span>}
                      </span>
                      <span className="text-sm tabular-nums font-medium text-fg-secondary shrink-0">{fmt(claim.amount)}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Running total + actions */}
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-surface px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-fg-secondary">
                Selected total ({selectedLotIds.size + selectedJobIds.size} item{selectedLotIds.size + selectedJobIds.size !== 1 ? 's' : ''})
              </span>
              <span className="text-lg font-bold text-fg">{fmt(runningTotal)}</span>
            </div>

            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Invoice date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                />
              </div>
              <div className="flex-1 min-w-40">
                <label className="block text-xs font-medium text-fg-muted mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Invoice #123"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={!hasSelections || isPending}
                onClick={handleMarkAsInvoiced}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {invoicingStep === 'snapshots' ? 'Generating PDFs…' : invoicingStep === 'saving' ? 'Marking…' : 'Mark as Invoiced'}
              </button>

              {selectedLots.length > 0 && (
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => {
                    setGenerating(true)
                    setError(null)
                    downloadZip(selectedLots, setError, () => setGenerating(false))
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-green-300 dark:border-green-700 px-4 py-2 text-sm font-medium text-accent-fg hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generating ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  )}
                  {generating ? 'Creating ZIP…' : 'Download ZIP'}
                </button>
              )}
            </div>

            {error && <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
            {warning && <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{warning}</p>}
          </div>

        </div>
      )}
    </div>
  )
}
