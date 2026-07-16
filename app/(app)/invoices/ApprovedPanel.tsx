'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { markAsInvoiced } from './actions'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'
import type { LotSection } from './InvoicesView'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovedLot = {
  id: string
  lotNumber: string
  siteName: string
  clientContact: string | null
  siteId: string
  stageName: string
  stageId: string
  standardAmount: number
  clientExtrasAmount: number
  contractPrice: number | null
  showClientExtras: boolean
  sections: LotSection[]
}

export type ApprovedExtraJob = {
  id: string
  title: string
  siteName: string
  siteId: string
  stageId: string
  amount: number
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

function fmtQty(n: number): string {
  return parseFloat(n.toFixed(3)).toString()
}

// ── PDF generation ────────────────────────────────────────────────────────────

const CLAIM_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .invoice-page { padding: 24px 28px; }
.html2pdf__container .page-break { page-break-before: always; break-before: page; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #111; }
.html2pdf__container .hdr-left h1 { font-size: 14px; font-weight: bold; margin-bottom: 3px; }
.html2pdf__container .hdr-left .lbl { font-size: 11px; font-weight: bold; color: #222; margin: 3px 0; }
.html2pdf__container .hdr-left .sub { font-size: 10px; color: #555; margin-top: 2px; }
.html2pdf__container .hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 5px 6px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
.html2pdf__container td.r { text-align: right; white-space: nowrap; }
.html2pdf__container td.u { color: #666; white-space: nowrap; }
.html2pdf__container tr.sec td { background: #efefef; font-weight: bold; font-size: 10px; padding: 5px 6px; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; }
.html2pdf__container tr.sub td { background: #f9f9f9; font-weight: 600; border-top: 1px solid #ddd; border-bottom: 2px solid #ccc; }
.html2pdf__container tr.grand td { background: #f0f0f0; font-weight: bold; font-size: 12px; border-top: 3px solid #999; padding: 7px 6px; }
.html2pdf__container .note { margin-top: 14px; font-size: 9px; color: #999; }
</style>`

function lotClaimHtml(lot: ApprovedLot): string {
  const date  = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const grand = lot.contractPrice ?? (lot.standardAmount + lot.clientExtrasAmount)

  let tableContent: string
  if (lot.contractPrice != null) {
    tableContent = `
      <tr><td></td><td>Contract Price</td><td class="r">1</td><td class="u">Lot</td><td class="r">${fmt(lot.contractPrice)}</td><td class="r">${fmt(lot.contractPrice)}</td></tr>
      <tr class="grand"><td colspan="5">Grand Total (ex GST)</td><td class="r">${fmt(grand)}</td></tr>`
  } else {
    const standard = lot.sections.filter((s) => !s.isClientExtra)
    const extras   = lot.showClientExtras ? lot.sections.filter((s) => s.isClientExtra) : []
    let secIdx = 0
    const sectionRows = [...standard, ...extras].map((section) => {
      secIdx++
      const prefix = section.isClientExtra ? 'E' : String(secIdx)
      const items  = section.items.map((item, i) => `
        <tr>
          <td class="r" style="color:#888;font-size:10px">${prefix}.${i + 1}</td>
          <td>${item.name}</td>
          <td class="r">${fmtQty(item.quantity)}</td>
          <td class="u">${item.unit}</td>
          <td class="r">${item.rate > 0 ? fmt(item.rate) : '—'}</td>
          <td class="r">${item.rate > 0 ? fmt(item.total) : '—'}</td>
        </tr>`).join('')
      return `
        <tr class="sec"><td colspan="6">${section.name}</td></tr>
        ${items}
        <tr class="sub"><td colspan="5">Subtotal — ${section.name}</td><td class="r">${fmt(section.subtotal)}</td></tr>`
    }).join('')
    tableContent = `${sectionRows}
      <tr class="grand"><td colspan="5">Grand Total (ex GST)</td><td class="r">${fmt(grand)}</td></tr>`
  }

  return `
<div class="invoice-page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>${lot.siteName} — Lot ${lot.lotNumber}</h1>
      <div class="lbl">${lot.contractPrice != null ? 'Contract Price' : 'Final Price — ACTUAL'}</div>
      ${lot.clientContact ? `<div class="sub">Developer: ${lot.clientContact}</div>` : ''}
      <div class="sub">Stage: ${lot.stageName}</div>
      <div class="sub">${date}</div>
    </div>
    <div class="hdr-right">${LOGO_DATA_URL ? `<img src="${LOGO_DATA_URL}" alt="Earthcare Landscapes" />` : ''}</div>
  </div>
  <table>
    <thead><tr>
      <th>Code</th><th>Description</th>
      <th class="r">Qty</th><th>Unit</th>
      <th class="r">Rate</th><th class="r">Total (ex GST)</th>
    </tr></thead>
    <tbody>${tableContent}</tbody>
  </table>
  <div class="note">All amounts are exclusive of GST. GST of 10% applies.</div>
</div>`
}

async function downloadCombinedPDF(
  lots: ApprovedLot[],
  onError: (msg: string) => void,
  onDone: () => void
) {
  const el = document.createElement('div')
  const bodies = lots.map((lot, i) =>
    `<div${i > 0 ? ' class="page-break"' : ''}>${lotClaimHtml(lot)}</div>`
  )
  el.innerHTML = CLAIM_STYLES + bodies.join('')
  try {
    const { default: html2pdf } = await import('html2pdf.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (html2pdf() as any)
      .set({
        margin: 0,
        filename: `Approved-Lots-${new Date().toISOString().slice(0, 10)}.pdf`,
        image:       { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['css', 'legacy'] },
      })
      .from(el)
      .save()
  } catch {
    onError('Failed to generate PDF. Please try again.')
  } finally {
    onDone()
  }
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
    startTransition(async () => {
      const fd = new FormData()
      fd.set('lot_ids',            [...selectedLotIds].join(','))
      fd.set('extra_job_ids',     [...selectedJobIds].join(','))
      fd.set('progress_claim_ids', [...selectedClaimIds].join(','))
      fd.set('total_amount', String(runningTotal))
      fd.set('invoice_date', new Date(invoiceDate + 'T00:00:00').toISOString())
      fd.set('notes',        notes)
      const result = await markAsInvoiced(null, fd)
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
                {isPending ? 'Marking…' : 'Mark as Invoiced'}
              </button>

              {selectedLots.length > 0 && (
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => {
                    setGenerating(true)
                    setError(null)
                    downloadCombinedPDF(selectedLots, setError, () => setGenerating(false))
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-green-300 dark:border-green-700 px-4 py-2 text-sm font-medium text-accent-fg hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generating ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  )}
                  {generating ? 'Generating…' : 'Download claim sheets'}
                </button>
              )}
            </div>

            {error && <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
          </div>

        </div>
      )}
    </div>
  )
}
