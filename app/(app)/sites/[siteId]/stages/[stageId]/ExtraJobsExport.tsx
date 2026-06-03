'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getExtraJobsPricing } from './extra-jobs/[extraJobId]/pricing-actions'
import type { ExtraJobStatus } from '@/types/database'
import { EXTRA_JOB_STATUS_CONFIG } from '@/lib/lotStatus'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExtraJob = {
  id: string
  title: string
  description: string | null
  status: string
}

interface Props {
  extraJobs: ExtraJob[]
  siteId: string
  stageId: string
  siteName: string
  stageName: string
  canManage: boolean
}

import { LOGO_DATA_URL } from '@/lib/pdfAssets'

// ── PDF helpers ────────────────────────────────────────────────────────────────

const PDF_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .pdf-page { padding: 24px 28px; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #111; }
.html2pdf__container .hdr-left h1 { font-size: 15px; font-weight: bold; margin-bottom: 3px; }
.html2pdf__container .hdr-left .sub { font-size: 10px; color: #555; margin-top: 3px; }
.html2pdf__container .hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container .job-title { font-size: 12px; font-weight: bold; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 4px 6px; border-bottom: 1px solid #bbb; text-align: left; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 4px 6px; border-bottom: 1px solid #eee; }
.html2pdf__container td.r { text-align: right; white-space: nowrap; }
.html2pdf__container td.code { color: #888; white-space: nowrap; font-size: 10px; }
.html2pdf__container tr.subtotal td { font-weight: 600; border-top: 1px solid #ddd; border-bottom: 2px solid #ccc; background: #fafafa; }
.html2pdf__container tr.grand-total td { font-weight: bold; font-size: 12px; border-top: 3px solid #999; background: #f0f0f0; padding: 7px 6px; }
.html2pdf__container .note { margin-top: 14px; font-size: 9px; color: #999; }
</style>`

function fmtCurrency(n: number) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function slug(...parts: (string | undefined | null)[]): string {
  return parts
    .filter(Boolean)
    .map((p) => p!.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .join('-')
}

function buildPDFHtml(
  jobs: Awaited<ReturnType<typeof getExtraJobsPricing>>,
  siteName: string,
  stageName: string,
): string {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  let grandTotal = 0

  const jobSections = jobs.map((job, jobIdx) => {
    const itemRows = job.items.map((item, itemIdx) => {
      const total = item.unit_price != null ? item.quantity * item.unit_price : null
      if (total != null) grandTotal += total
      const qty = item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2)
      return `<tr>
        <td class="code">E${jobIdx + 1}.${itemIdx + 1}</td>
        <td>${item.item_name}</td>
        <td class="r">${qty}</td>
        <td>${item.unit}</td>
        <td class="r">${item.unit_price != null ? fmtCurrency(item.unit_price) : '—'}</td>
        <td class="r">${total != null ? fmtCurrency(total) : '—'}</td>
      </tr>`
    }).join('')

    return `
      <div class="job-title">${jobIdx + 1}. ${job.title}</div>
      <table>
        <thead><tr>
          <th>Code</th><th>Description</th>
          <th class="r">Qty</th><th>Unit</th>
          <th class="r">Rate</th><th class="r">Total</th>
        </tr></thead>
        <tbody>
          ${itemRows || '<tr><td colspan="6" style="color:#aaa;font-style:italic;padding:6px">No pricing entered</td></tr>'}
          <tr class="subtotal">
            <td colspan="5">Subtotal — ${job.title}</td>
            <td class="r">${fmtCurrency(job.total)}</td>
          </tr>
        </tbody>
      </table>`
  }).join('')

  return `${PDF_STYLES}
<div class="pdf-page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>${siteName} — ${stageName}</h1>
      <div class="sub">Extras Claim</div>
      <div class="sub">${date}</div>
    </div>
    <div class="hdr-right">
      <img src="${LOGO_DATA_URL}" alt="Earthcare Landscapes" />
    </div>
  </div>
  ${jobSections}
  <table style="margin-top:8px">
    <tbody>
      <tr class="grand-total">
        <td colspan="5">Grand Total (ex GST)</td>
        <td class="r">${fmtCurrency(grandTotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="note">All amounts are exclusive of GST. GST of 10% applies.</div>
</div>`
}

async function downloadPDF(html: string, filename: string, onError: (m: string) => void) {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i)
  const cssText    = styleMatch ? styleMatch[1] : ''
  const bodyHtml   = html.replace(/<style>[\s\S]*?<\/style>/gi, '')

  const styleEl = document.createElement('style')
  styleEl.textContent = cssText
  document.head.appendChild(styleEl)

  const el = document.createElement('div')
  el.innerHTML = bodyHtml

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => { requestAnimationFrame(() => resolve()) })
  )

  try {
    const { default: html2pdf } = await import('html2pdf.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (html2pdf() as any)
      .set({
        margin: 0, filename,
        image:       { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['css', 'legacy'] },
      })
      .from(el).save()
  } catch {
    onError('Failed to generate PDF. Please try again.')
  } finally {
    document.head.removeChild(styleEl)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExtraJobsExport({
  extraJobs, siteId, stageId, siteName, stageName, canManage,
}: Props) {
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  function toggleJob(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  async function handleExport() {
    if (selected.size === 0) return
    setGenerating(true)
    setExportError(null)
    try {
      const data = await getExtraJobsPricing([...selected])
      if (data.length === 0) {
        setExportError('No data found for selected jobs.')
        return
      }
      const html     = buildPDFHtml(data, siteName, stageName)
      const filename = slug(siteName, stageName, 'Extras-Claim') + '.pdf'
      await downloadPDF(html, filename, setExportError)
    } catch {
      setExportError('Export failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (extraJobs.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-10 text-center">
        <p className="text-sm text-stone-500">No extra jobs yet.</p>
        {canManage && (
          <Link
            href={`/sites/${siteId}/stages/${stageId}/extra-jobs/new`}
            className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline"
          >
            Add the first extra job →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Export action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
          <span className="text-sm font-medium text-green-800">
            {selected.size} job{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors"
            >
              {generating
                ? <><SpinnerIcon />Generating…</>
                : <><PdfIcon />Export extras claim</>}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-green-700 hover:text-green-900"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {exportError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{exportError}</p>
      )}

      {/* Jobs list with checkboxes */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
        {extraJobs.map((job) => {
          const jobStatus  = job.status as ExtraJobStatus
          const cfg        = EXTRA_JOB_STATUS_CONFIG[jobStatus] ?? EXTRA_JOB_STATUS_CONFIG.not_started
          const isSelected = selected.has(job.id)
          return (
            <div
              key={job.id}
              className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-stone-50'}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleJob(job.id)}
                className="h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600 cursor-pointer shrink-0"
              />
              <Link
                href={`/sites/${siteId}/stages/${stageId}/extra-jobs/${job.id}`}
                className="min-w-0 flex-1 flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-stone-900">{job.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {job.description && (
                    <p className="mt-0.5 text-xs text-stone-500 truncate">{job.description}</p>
                  )}
                </div>
                <svg className="h-4 w-4 shrink-0 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PdfIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 mr-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 animate-spin mr-0.5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
