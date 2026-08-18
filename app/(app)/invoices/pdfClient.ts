// Shared client-side claim-sheet PDF rendering — used by both ApprovedPanel
// (generating snapshots at the moment of invoicing) and InvoiceHistory
// (regenerating a claim sheet from current data when no historical snapshot
// exists). html2pdf.js only runs in a browser (it rasterizes DOM via
// html2canvas), so this must stay client-side; there is no server-side
// equivalent of this renderer.

import { LOGO_DATA_URL } from '@/lib/pdfAssets'
import type { LotSection } from './InvoicesView'

export type ClaimLotData = {
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

export type ClaimExtraJobItem = {
  name: string
  quantity: number
  unit: string
  rate: number
  total: number
}

export type ClaimExtraJobData = {
  id: string
  title: string
  siteName: string
  stageName: string
  description: string | null
  notes: string | null
  financeNotes: string | null
  items: ClaimExtraJobItem[]
  total: number
}

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(n: number): string {
  return parseFloat(n.toFixed(3)).toString()
}

export const CLAIM_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .invoice-page { padding: 38px 32px 48px; }
.html2pdf__container .page-break { page-break-before: always; break-before: page; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; padding-bottom: 14px; border-bottom: 2px solid #111; }
.html2pdf__container .hdr-left h1 { font-size: 14px; font-weight: bold; margin-bottom: 3px; }
.html2pdf__container .hdr-left .lbl { font-size: 11px; font-weight: bold; color: #222; margin: 3px 0; }
.html2pdf__container .hdr-left .sub { font-size: 10px; color: #555; margin-top: 2px; }
.html2pdf__container .hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 8px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
.html2pdf__container td.r { text-align: right; white-space: nowrap; }
.html2pdf__container td.u { color: #666; white-space: nowrap; }
.html2pdf__container tr.sec td { background: #e3e3e3; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; padding: 10px 8px 8px; border-top: 1px solid #bbb; border-bottom: 1px solid #bbb; }
.html2pdf__container tr.sec:first-child td { border-top: none; }
.html2pdf__container tr.secsub td { font-size: 10px; font-weight: 600; color: #777; padding-top: 5px; padding-bottom: 9px; border-bottom: 1px solid #eee; }
.html2pdf__container tr.sub td { background: #f9f9f9; font-weight: 600; padding-top: 8px; padding-bottom: 8px; border-top: 1px solid #ddd; border-bottom: 2px solid #ccc; }
.html2pdf__container tr.grand td { background: #f0f0f0; font-weight: bold; font-size: 12px; border-top: 3px solid #999; padding: 11px 8px; }
.html2pdf__container .note { margin-top: 20px; font-size: 9px; color: #999; }
</style>`

export function lotClaimHtml(lot: ClaimLotData): string {
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
    function sectionItemRows(section: LotSection): string {
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
      const sectionSubtotal = items
        ? `<tr class="secsub"><td colspan="5">Subtotal</td><td class="r">${fmt(section.subtotal)}</td></tr>`
        : ''
      return `
        <tr class="sec"><td colspan="6">${section.name}</td></tr>
        ${items}
        ${sectionSubtotal}`
    }

    // Each section gets its own subtotal row (sectionItemRows above), plus
    // two aggregate subtotals — Providence Works (standard sections) and
    // Client Extras — using the already-computed lot totals.
    const standardRows = standard.map(sectionItemRows).join('')
    const providenceSubtotal = standard.length > 0
      ? `<tr class="sub"><td colspan="5">Subtotal — Providence Works</td><td class="r">${fmt(lot.standardAmount)}</td></tr>`
      : ''

    const extrasRows = extras.map(sectionItemRows).join('')
    const extrasSubtotal = extras.length > 0
      ? `<tr class="sub"><td colspan="5">Subtotal — Client Extras</td><td class="r">${fmt(lot.clientExtrasAmount)}</td></tr>`
      : ''

    tableContent = `${standardRows}${providenceSubtotal}${extrasRows}${extrasSubtotal}
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

export function pdfFilename(lot: ClaimLotData): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `Lot-${clean(lot.lotNumber)}-${clean(lot.siteName)}-${clean(lot.stageName)}.pdf`
}

// Extra job claim sheet — same header/table/note styling as the lot claim
// sheet (CLAIM_STYLES is generic, not lot-specific), branching the same way
// lotClaimHtml does: itemized line items when pricing has been entered,
// otherwise a single "Agreed Amount" row.
export function extraJobClaimHtml(job: ClaimExtraJobData): string {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  const tableContent = job.items.length > 0
    ? `${job.items.map((item, i) => `
        <tr>
          <td class="r" style="color:#888;font-size:10px">${i + 1}</td>
          <td>${item.name}</td>
          <td class="r">${fmtQty(item.quantity)}</td>
          <td class="u">${item.unit}</td>
          <td class="r">${item.rate > 0 ? fmt(item.rate) : '—'}</td>
          <td class="r">${item.rate > 0 ? fmt(item.total) : '—'}</td>
        </tr>`).join('')}
      <tr class="grand"><td colspan="5">Grand Total (ex GST)</td><td class="r">${fmt(job.total)}</td></tr>`
    : `
      <tr><td></td><td>Agreed Amount</td><td class="r">1</td><td class="u">Job</td><td class="r">${fmt(job.total)}</td><td class="r">${fmt(job.total)}</td></tr>
      <tr class="grand"><td colspan="5">Grand Total (ex GST)</td><td class="r">${fmt(job.total)}</td></tr>`

  const notesBlock = [
    job.description ? `<div class="sub"><strong>Description:</strong> ${job.description}</div>` : '',
    job.notes ? `<div class="sub"><strong>Notes:</strong> ${job.notes}</div>` : '',
    job.financeNotes ? `<div class="sub"><strong>Finance notes:</strong> ${job.financeNotes}</div>` : '',
  ].filter(Boolean).join('')

  return `
<div class="invoice-page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>${job.siteName} — ${job.title}</h1>
      <div class="lbl">Extra Job</div>
      <div class="sub">Stage: ${job.stageName}</div>
      <div class="sub">${date}</div>
      ${notesBlock}
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

export function extraJobPdfFilename(job: ClaimExtraJobData): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `ExtraJob-${clean(job.title)}-${clean(job.siteName)}-${clean(job.stageName)}.pdf`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stampPageNumbers(pdf: any) {
  const pageCount  = pdf.internal.getNumberOfPages()
  const pageWidth  = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(150)
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
  }
}

// Shared html2pdf.js plumbing — renders a styled HTML fragment to a PDF Blob.
// Must be called from the browser (dynamic-imports html2pdf.js, which needs a DOM).
async function renderHtmlToPdfBlob(html: string): Promise<Blob> {
  const { default: html2pdf } = await import('html2pdf.js')
  const el = document.createElement('div')
  el.innerHTML = html
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await (html2pdf() as any)
    .set({
      margin: 0,
      image:       { type: 'jpeg', quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(el)
    .toPdf()
    .get('pdf')
  stampPageNumbers(pdf)
  return pdf.output('blob')
}

// Renders a single lot's claim sheet to a PDF Blob via html2pdf.js.
export async function generateClaimPdfBlob(lot: ClaimLotData): Promise<Blob> {
  return renderHtmlToPdfBlob(CLAIM_STYLES + lotClaimHtml(lot))
}

// Renders a single extra job's claim sheet to a PDF Blob via html2pdf.js.
export async function generateExtraJobPdfBlob(job: ClaimExtraJobData): Promise<Blob> {
  return renderHtmlToPdfBlob(CLAIM_STYLES + extraJobClaimHtml(job))
}

// Triggers a browser download for an already-fetched Blob.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Converts a data: URL (as returned by getR2FileAsDataUrl on the server) to a
// Blob and downloads it.
export async function downloadDataUrl(dataUrl: string, filename: string) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  downloadBlob(blob, filename)
}
