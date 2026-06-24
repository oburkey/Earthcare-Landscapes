'use client'

import { useState, useTransition } from 'react'
import { toggleInvoiced } from './actions'
import { getExtraJobsPricing } from '@/app/(app)/sites/[siteId]/stages/[stageId]/extra-jobs/[extraJobId]/pricing-actions'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LotLineItem = {
  name: string
  quantity: number
  unit: string
  rate: number
  total: number
}

export type LotSection = {
  id: string
  name: string
  isClientExtra: boolean
  orderIndex: number
  items: LotLineItem[]
  subtotal: number
}

export type LotRow = {
  id: string
  lotNumber: string
  buildComplete: boolean
  quantDone: boolean
  invoiced: boolean
  standardAmount: number
  clientExtrasAmount: number
  sections: LotSection[]
  showClientExtras: boolean
  contractPrice: number | null
}

export type ExtraJobRow = {
  id: string
  title: string
  status: string
  total: number
}

export type StageData = {
  id: string
  name: string
  lots: LotRow[]
  extraJobs: ExtraJobRow[]
}

export type SiteData = {
  id: string
  name: string
  clientContact: string | null
  stages: StageData[]
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtQty(n: number): string {
  return parseFloat(n.toFixed(3)).toString()
}

function stageTotal(lots: LotRow[], key: keyof LotRow): number {
  return lots.reduce((sum, l) => sum + (l[key] as number), 0)
}

function slug(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p != null && p !== '')
    .map((p) => String(p).trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .join('-')
}

// ── PDF: Claim sheet styles + body builder ────────────────────────────────────

// All selectors are scoped to .html2pdf__container — the class html2pdf puts on its
// own rendering container — so styles never leak to the live page.
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
.html2pdf__container .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 14px; font-size: 10px; color: #555; }
.html2pdf__container .meta strong { color: #111; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 5px 6px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
.html2pdf__container td.code { color: #888; white-space: nowrap; font-size: 10px; }
.html2pdf__container td.r    { text-align: right; white-space: nowrap; }
.html2pdf__container td.u    { color: #666; white-space: nowrap; }
.html2pdf__container tr.sec td { background: #efefef; font-weight: bold; font-size: 10px; padding: 5px 6px; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; }
.html2pdf__container tr.sub td { background: #f9f9f9; font-weight: 600; border-top: 1px solid #ddd; border-bottom: 2px solid #ccc; }
.html2pdf__container tr.grand td { background: #f0f0f0; font-weight: bold; font-size: 12px; border-top: 3px solid #999; padding: 7px 6px; }
.html2pdf__container .note { margin-top: 14px; font-size: 9px; color: #999; }
</style>`

function claimSheetBody(
  site: SiteData,
  stageName: string,
  lot: LotRow,
  invoiced: boolean,
  logoSrc: string
): string {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

  const grand = lot.contractPrice ?? (lot.standardAmount + lot.clientExtrasAmount)

  let tableContent: string
  if (lot.contractPrice != null) {
    tableContent = `
      <tr>
        <td class="code">1</td>
        <td>Contract Price</td>
        <td class="r">1</td>
        <td class="u">Lot</td>
        <td class="r">${fmt(lot.contractPrice)}</td>
        <td class="r">${fmt(lot.contractPrice)}</td>
      </tr>
      <tr class="grand">
        <td colspan="5">Grand Total (ex GST)</td>
        <td class="r">${fmt(grand)}</td>
      </tr>`
  } else {
    const standard = lot.sections.filter((s) => !s.isClientExtra)
    const extras   = lot.showClientExtras ? lot.sections.filter((s) => s.isClientExtra) : []
    let secIdx = 0
    const sectionRows = [...standard, ...extras].map((section) => {
      secIdx++
      const prefix = section.isClientExtra ? 'E' : String(secIdx)
      const items = section.items.map((item, i) => `
        <tr>
          <td class="code">${prefix}.${i + 1}</td>
          <td>${item.name}</td>
          <td class="r">${fmtQty(item.quantity)}</td>
          <td class="u">${item.unit}</td>
          <td class="r">${item.rate > 0 ? fmt(item.rate) : '—'}</td>
          <td class="r">${item.rate > 0 ? fmt(item.total) : '—'}</td>
        </tr>`).join('')
      return `
        <tr class="sec"><td colspan="6">${section.name}</td></tr>
        ${items}
        <tr class="sub">
          <td colspan="5">Subtotal — ${section.name}</td>
          <td class="r">${fmt(section.subtotal)}</td>
        </tr>`
    }).join('')
    tableContent = `${sectionRows}
      <tr class="grand">
        <td colspan="5">Grand Total (ex GST)</td>
        <td class="r">${fmt(grand)}</td>
      </tr>`
  }

  return `
<div class="invoice-page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>${site.name} — Lot ${lot.lotNumber}</h1>
      <div class="lbl">${lot.contractPrice != null ? 'Contract Price' : 'Final Price — ACTUAL'}</div>
      ${site.clientContact ? `<div class="sub">Developer: ${site.clientContact}</div>` : ''}
      <div class="sub">Stage: ${stageName}</div>
      <div class="sub">${date}</div>
    </div>
    <div class="hdr-right">
      ${logoSrc ? `<img src="${logoSrc}" alt="Earthcare Landscapes" style="max-width:130px;max-height:55px;object-fit:contain;display:block;" />` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Code</th><th>Description</th>
        <th class="r">Qty</th><th>Unit</th>
        <th class="r">Rate</th><th class="r">Total (ex GST)</th>
      </tr>
    </thead>
    <tbody>
      ${tableContent}
    </tbody>
  </table>
  <div class="note">All amounts are exclusive of GST. GST of 10% applies.</div>
</div>`
}

// ── PDF: Stage summary styles + body builder ──────────────────────────────────

const SUMMARY_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .summary-page { padding: 24px 28px; }
.html2pdf__container .hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #111; }
.html2pdf__container .hdr-left h1 { font-size: 16px; font-weight: bold; }
.html2pdf__container .hdr-left h2 { font-size: 13px; color: #444; margin-top: 3px; }
.html2pdf__container .hdr-left .dt { font-size: 10px; color: #888; margin-top: 5px; }
.html2pdf__container .hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 1px solid #bbb; padding: 5px 8px; text-align: left; white-space: nowrap; }
.html2pdf__container td { padding: 5px 8px; border-bottom: 1px solid #eee; }
.html2pdf__container tr.tot td { border-top: 2px solid #aaa; border-bottom: none; background: #f7f7f7; font-weight: bold; }
.html2pdf__container .r { text-align: right; }
.html2pdf__container .c { text-align: center; }
</style>`

function stageSummaryBody(
  site: SiteData,
  stage: StageData,
  invoicedMap: Record<string, boolean>,
  logoSrc: string
): string {
  const date     = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const totStd   = stage.lots.reduce((s, l) => s + (l.contractPrice != null ? 0 : l.standardAmount), 0)
  const totExtra = stage.lots.reduce((s, l) => s + (l.contractPrice != null ? 0 : l.clientExtrasAmount), 0)
  const totContract = stage.lots.reduce((s, l) => s + (l.contractPrice ?? 0), 0)
  const totAmt   = totStd + totExtra + totContract

  const rows = stage.lots.map((lot) => {
    const inv   = invoicedMap[lot.id] ?? lot.invoiced
    const total = lot.contractPrice ?? (lot.standardAmount + lot.clientExtrasAmount)
    return `<tr>
      <td>Lot ${lot.lotNumber}${lot.contractPrice != null ? ' <span style="color:#7c3aed;font-size:9px;font-weight:600">CONTRACT</span>' : ''}</td>
      <td class="c">${lot.buildComplete ? '✓' : '—'}</td>
      <td class="c">${lot.quantDone ? '✓' : '—'}</td>
      <td class="r">${lot.contractPrice != null ? '—' : fmt(lot.standardAmount)}</td>
      <td class="r">${lot.contractPrice != null ? '—' : (lot.clientExtrasAmount > 0 ? fmt(lot.clientExtrasAmount) : '—')}</td>
      <td class="r" style="font-weight:600">${fmt(total)}</td>
      <td class="c">${inv ? '✓' : ''}</td>
    </tr>`
  }).join('')

  return `
<div class="summary-page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>${site.name}</h1>
      <h2>${stage.name} — Stage Summary</h2>
      <div class="dt">${date}</div>
    </div>
    <div class="hdr-right">
      ${logoSrc ? `<img src="${logoSrc}" alt="Earthcare Landscapes" style="max-width:130px;max-height:55px;object-fit:contain;display:block;" />` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Lot</th>
        <th class="c">Build Complete</th>
        <th class="c">Quant Done</th>
        <th class="r">Standard Amount</th>
        <th class="r">Client Extras</th>
        <th class="r">Total (ex GST)</th>
        <th class="c">Invoiced</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="tot">
        <td colspan="3">Stage Total</td>
        <td class="r">${fmt(totStd)}</td>
        <td class="r">${totExtra > 0 ? fmt(totExtra) : '—'}</td>
        <td class="r">${fmt(totAmt)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>`
}

// ── Extras claim PDF ──────────────────────────────────────────────────────────

const EXTRAS_STYLES = `
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
.html2pdf__container td.code { color: #888; font-size: 10px; white-space: nowrap; }
.html2pdf__container tr.subtotal td { font-weight: 600; border-top: 1px solid #ddd; border-bottom: 2px solid #ccc; background: #fafafa; }
.html2pdf__container tr.grand-total td { font-weight: bold; font-size: 12px; border-top: 3px solid #999; background: #f0f0f0; padding: 7px 6px; }
.html2pdf__container .note { margin-top: 14px; font-size: 9px; color: #999; }
</style>`

function buildExtrasHtml(
  jobs: Awaited<ReturnType<typeof getExtraJobsPricing>>,
  headerTitle: string,
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
        <td class="r">${item.unit_price != null ? fmt(item.unit_price) : '—'}</td>
        <td class="r">${total != null ? fmt(total) : '—'}</td>
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
            <td class="r">${fmt(job.total)}</td>
          </tr>
        </tbody>
      </table>`
  }).join('')

  return `${EXTRAS_STYLES}
<div class="pdf-page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>${headerTitle}</h1>
      <div class="sub">Extras Claim · ${date}</div>
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
        <td class="r">${fmt(grandTotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="note">All amounts are exclusive of GST. GST of 10% applies.</div>
</div>`
}

// ── PDF download via html2pdf.js ──────────────────────────────────────────────

async function downloadPDF(
  contentHtml: string,
  filename: string,
  onError: (msg: string) => void,
  onDone: () => void
) {
  // Create a plain element with NO inline positioning styles.
  //
  // Why: html2pdf deep-clones whatever element we pass and appends the clone
  // as a child of its own positioned container (.html2pdf__container).
  // Any inline position/left/top we put on our element is cloned too, and
  // would displace the content inside html2pdf's container — causing a blank PDF.
  //
  // html2pdf's own toContainer() sets position, width, and background on its
  // wrapper div, and has a built-in 10ms setTimeout before capturing — so we
  // don't need to manage timing or DOM insertion ourselves.
  //
  // Styles are scoped to .html2pdf__container in the <style> tag so they
  // never leak to the live page (html2pdf puts that class on its own wrapper).
  const el = document.createElement('div')
  el.innerHTML = contentHtml

  try {
    const { default: html2pdf } = await import('html2pdf.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (html2pdf() as any)
      .set({
        margin: 0,
        filename,
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

// ── Main component ────────────────────────────────────────────────────────────

export default function InvoicesView({ sites }: { sites: SiteData[] }) {
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())
  // Stages start collapsed by default
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set())
  const [invoicedMap, setInvoicedMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(
      sites.flatMap((s) => s.stages.flatMap((st) => st.lots.map((l) => [l.id, l.invoiced])))
    )
  )
  const [selectedLots, setSelectedLots]           = useState<Set<string>>(new Set())
  const [selectedExtraJobs, setSelectedExtraJobs] = useState<Set<string>>(new Set())
  const [generating, setGenerating]               = useState<Set<string>>(new Set())
  const [actionError, setActionError]             = useState<string | null>(null)
  const [isPending, startTransition]              = useTransition()

  // ── Helpers ────────────────────────────────────────────────────────────────

  function startGen(id: string) {
    setGenerating((prev) => new Set([...prev, id]))
    setActionError(null)
  }
  function endGen(id: string) {
    setGenerating((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  function toggleSite(siteId: string) {
    setExpandedSites((prev) => {
      const next = new Set(prev)
      if (next.has(siteId)) { next.delete(siteId) } else { next.add(siteId) }
      return next
    })
  }

  function toggleStage(stageId: string) {
    setExpandedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) { next.delete(stageId) } else { next.add(stageId) }
      return next
    })
  }

  function toggleLotSelection(lotId: string) {
    setSelectedLots((prev) => {
      const next = new Set(prev)
      if (next.has(lotId)) { next.delete(lotId) } else { next.add(lotId) }
      return next
    })
  }

  function toggleStageSelection(stage: StageData, checked: boolean) {
    setSelectedLots((prev) => {
      const next = new Set(prev)
      stage.lots.forEach((l) => { if (checked) next.add(l.id); else next.delete(l.id) })
      return next
    })
  }

  function handleToggleInvoiced(lotId: string, current: boolean) {
    const next = !current
    setInvoicedMap((prev) => ({ ...prev, [lotId]: next }))
    setActionError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('lot_id', lotId)
      fd.set('value', String(next))
      const result = await toggleInvoiced(null, fd)
      if (result?.error) {
        setInvoicedMap((prev) => ({ ...prev, [lotId]: current }))
        setActionError(result.error)
      }
    })
  }

  function toggleExtraJobSelection(jobId: string) {
    setSelectedExtraJobs((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) { next.delete(jobId) } else { next.add(jobId) }
      return next
    })
  }

  async function exportSelectedExtras() {
    const genId = 'extras-batch'
    startGen(genId)
    try {
      const jobIds = [...selectedExtraJobs]
      const data = await getExtraJobsPricing(jobIds)
      if (data.length === 0) { setActionError('No pricing data for selected extra jobs.'); return }
      // Determine header title from context
      const siteNames: string[] = []
      for (const site of sites) {
        for (const stage of site.stages) {
          if (stage.extraJobs.some((j) => selectedExtraJobs.has(j.id))) {
            siteNames.push(site.name)
          }
        }
      }
      const headerTitle = [...new Set(siteNames)].join(' / ') || 'Extras Claim'
      const html     = buildExtrasHtml(data, headerTitle)
      const filename = slug(...[...new Set(siteNames)], 'Extras-Claim') + '.pdf'
      downloadPDF(html, filename, setActionError, () => {})
    } catch {
      setActionError('Failed to export extras claim.')
    } finally {
      endGen(genId)
    }
  }

  // ── Export functions ───────────────────────────────────────────────────────

  function exportLotClaimSheet(site: SiteData, stageName: string, lot: LotRow) {
    const genId    = lot.id
    const filename = slug(site.name, stageName, 'Lot', lot.lotNumber, 'Claim') + '.pdf'
    startGen(genId)
    const logoSrc = LOGO_DATA_URL
    const content = CLAIM_STYLES + claimSheetBody(site, stageName, lot, invoicedMap[lot.id] ?? lot.invoiced, logoSrc)
    downloadPDF(content, filename, setActionError, () => endGen(genId))
  }

  function exportSelectedClaimSheets() {
    const genId = 'batch'
    // Collect selected lots in site → stage → lot order
    type LotCtx = { site: SiteData; stageName: string; lot: LotRow }
    const selected: LotCtx[] = []
    for (const site of sites) {
      for (const stage of site.stages) {
        for (const lot of stage.lots) {
          if (selectedLots.has(lot.id)) selected.push({ site, stageName: stage.name, lot })
        }
      }
    }
    if (selected.length === 0) return

    // Determine filename context
    const siteNames  = [...new Set(selected.map((x) => x.site.name))]
    const stageNames = [...new Set(selected.map((x) => x.stageName))]
    const filename   = siteNames.length === 1 && stageNames.length === 1
      ? slug(siteNames[0], stageNames[0], 'Claims') + '.pdf'
      : siteNames.length === 1
        ? slug(siteNames[0], 'Claims') + '.pdf'
        : 'Claims.pdf'

    startGen(genId)
    const logoSrc = LOGO_DATA_URL

    // Build combined content: one lot body per page
    const bodies = selected.map(({ site, stageName, lot }, i) =>
      `<div${i > 0 ? ' class="page-break"' : ''}>${claimSheetBody(site, stageName, lot, invoicedMap[lot.id] ?? lot.invoiced, logoSrc)}</div>`
    )
    const content = CLAIM_STYLES + bodies.join('')

    downloadPDF(content, filename, setActionError, () => endGen(genId))
  }

  function exportStageSummary(site: SiteData, stage: StageData) {
    const genId    = `summary-${stage.id}`
    const filename = slug(site.name, stage.name, 'Summary') + '.pdf'
    startGen(genId)
    const logoSrc = LOGO_DATA_URL
    const content = SUMMARY_STYLES + stageSummaryBody(site, stage, invoicedMap, logoSrc)
    downloadPDF(content, filename, setActionError, () => endGen(genId))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (sites.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-16 text-center">
        <p className="text-sm font-medium text-stone-600">No lots ready for invoicing</p>
        <p className="mt-1 text-sm text-stone-400">
          Lots appear here once marked as Build Complete or Quant Done.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* Selection action bar — appears when lots or extra jobs are selected */}
      {(selectedLots.size > 0 || selectedExtraJobs.size > 0) && (
        <div className="sticky top-14 md:top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
          <span className="text-sm font-medium text-green-800">
            {[
              selectedLots.size > 0      ? `${selectedLots.size} lot${selectedLots.size !== 1 ? 's' : ''}` : null,
              selectedExtraJobs.size > 0 ? `${selectedExtraJobs.size} extra job${selectedExtraJobs.size !== 1 ? 's' : ''}` : null,
            ].filter(Boolean).join(' · ')} selected
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedLots.size > 0 && (
              <button
                type="button"
                onClick={exportSelectedClaimSheets}
                disabled={generating.has('batch')}
                className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors"
              >
                {generating.has('batch') ? <Spinner /> : <PdfIcon />}
                {generating.has('batch') ? 'Generating…' : 'Export claim sheets'}
              </button>
            )}
            {selectedExtraJobs.size > 0 && (
              <button
                type="button"
                onClick={exportSelectedExtras}
                disabled={generating.has('extras-batch')}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60 transition-colors"
              >
                {generating.has('extras-batch') ? <Spinner /> : <PdfIcon />}
                {generating.has('extras-batch') ? 'Generating…' : 'Export extras claim'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setSelectedLots(new Set()); setSelectedExtraJobs(new Set()) }}
              className="text-xs text-green-700 hover:text-green-900"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Site cards */}
      {sites.map((site) => {
        const isExpanded = expandedSites.has(site.id)
        const totalLots  = site.stages.reduce((n, st) => n + st.lots.length, 0)

        return (
          <div key={site.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">

            <button
              type="button"
              onClick={() => toggleSite(site.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition-colors"
            >
              <svg className={`h-4 w-4 text-stone-400 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
              <span className="text-base font-semibold text-stone-900 flex-1">{site.name}</span>
              {site.clientContact && (
                <span className="text-xs text-stone-400 shrink-0 hidden sm:block">{site.clientContact}</span>
              )}
              <span className="text-xs text-stone-400 shrink-0">
                {site.stages.length} stage{site.stages.length !== 1 ? 's' : ''} · {totalLots} lot{totalLots !== 1 ? 's' : ''}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-stone-100 divide-y divide-stone-100">
                {site.stages.map((stage) => {
                  const totStd        = stage.lots.reduce((s, l) => s + (l.contractPrice != null ? 0 : l.standardAmount), 0)
                  const totExtra      = stage.lots.reduce((s, l) => s + (l.contractPrice != null ? 0 : l.clientExtrasAmount), 0)
                  const totContract   = stage.lots.reduce((s, l) => s + (l.contractPrice ?? 0), 0)
                  const totAmt        = totStd + totExtra + totContract
                  const allSel        = stage.lots.length > 0 && stage.lots.every((l) => selectedLots.has(l.id))
                  const someSel       = stage.lots.some((l) => selectedLots.has(l.id))
                  const summaryId     = `summary-${stage.id}`
                  const isStageExpanded = expandedStages.has(stage.id)

                  return (
                    <div key={stage.id} className="border-b border-stone-100 last:border-0">

                      {/* Stage header — click to expand/collapse */}
                      <div className="flex items-center gap-3 px-5 py-3 flex-wrap">
                        <input
                          type="checkbox"
                          checked={allSel}
                          ref={(el) => { if (el) el.indeterminate = someSel && !allSel }}
                          onChange={(e) => toggleStageSelection(stage, e.target.checked)}
                          className="h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600 cursor-pointer shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => toggleStage(stage.id)}
                          className="flex items-center gap-2 flex-1 text-left hover:opacity-75 transition-opacity"
                        >
                          <svg className={`h-3.5 w-3.5 text-stone-400 shrink-0 transition-transform ${isStageExpanded ? '' : '-rotate-90'}`}
                            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                          <h3 className="text-sm font-semibold text-stone-700">{stage.name}</h3>
                          <span className="text-xs text-stone-400">
                            {stage.lots.length} lot{stage.lots.length !== 1 ? 's' : ''}
                            {stage.extraJobs.length > 0 && ` · ${stage.extraJobs.length} extra job${stage.extraJobs.length !== 1 ? 's' : ''}`}
                            {totAmt > 0 && ` · ${fmt(totAmt)}`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportStageSummary(site, stage)}
                          disabled={generating.has(summaryId)}
                          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60 transition-colors shrink-0"
                        >
                          {generating.has(summaryId) ? <Spinner /> : <PdfIcon />}
                          {generating.has(summaryId) ? 'Generating…' : 'Export stage summary'}
                        </button>
                      </div>

                      {/* Stage content — shown only when expanded */}
                      {isStageExpanded && <div className="px-5 pb-4">

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-stone-200">
                              <th className="pb-2 pr-3 w-8"></th>
                              <th className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 pr-6 whitespace-nowrap">Lot</th>
                              <th className="text-center text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-3 whitespace-nowrap">Build Complete</th>
                              <th className="text-center text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-3 whitespace-nowrap">Quant Done</th>
                              <th className="text-right text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-3 whitespace-nowrap">Standard Amount</th>
                              <th className="text-right text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-3 whitespace-nowrap">Client Extras</th>
                              <th className="text-right text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-3 whitespace-nowrap">Total</th>
                              <th className="text-center text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2 px-3 whitespace-nowrap">Invoiced</th>
                              <th className="pb-2 pl-2 w-7"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {stage.lots.map((lot) => {
                              const total    = lot.contractPrice ?? (lot.standardAmount + lot.clientExtrasAmount)
                              const invoiced = invoicedMap[lot.id] ?? lot.invoiced
                              const selected = selectedLots.has(lot.id)
                              const genning  = generating.has(lot.id)

                              return (
                                <tr key={lot.id} className={`border-b border-stone-100 transition-colors ${selected ? 'bg-green-50' : 'hover:bg-stone-50'}`}>
                                  <td className="py-2.5 pr-3">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleLotSelection(lot.id)}
                                      className="h-4 w-4 rounded border-stone-300 text-green-700 focus:ring-green-600 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2.5 pr-6 font-medium text-stone-900 whitespace-nowrap">
                                    Lot {lot.lotNumber}
                                    {lot.contractPrice != null && (
                                      <span className="ml-1.5 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Contract</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {lot.buildComplete ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-stone-300">—</span>}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {lot.quantDone ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-stone-300">—</span>}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-stone-700">
                                    {lot.contractPrice != null ? <span className="text-stone-300">—</span> : fmt(lot.standardAmount)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-stone-700">
                                    {lot.contractPrice != null ? <span className="text-stone-300">—</span> : (lot.clientExtrasAmount > 0 ? fmt(lot.clientExtrasAmount) : <span className="text-stone-300">—</span>)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-stone-900">{fmt(total)}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      type="button"
                                      disabled={isPending}
                                      onClick={() => handleToggleInvoiced(lot.id, invoiced)}
                                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 whitespace-nowrap ${invoiced ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                                    >
                                      {invoiced ? 'Invoiced' : 'Invoice'}
                                    </button>
                                  </td>
                                  <td className="py-2.5 pl-2">
                                    <button
                                      type="button"
                                      onClick={() => exportLotClaimSheet(site, stage.name, lot)}
                                      disabled={genning}
                                      title="Download claim sheet PDF"
                                      className="text-stone-300 hover:text-stone-600 disabled:opacity-40 transition-colors"
                                    >
                                      {genning ? <Spinner /> : <PdfIcon />}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}

                            <tr className="border-t-2 border-stone-300 bg-stone-50">
                              <td colSpan={4} className="py-2.5 pr-6 font-semibold text-stone-700">Stage Total</td>
                              <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-stone-700">{fmt(totStd)}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-stone-700">
                                {totExtra > 0 ? fmt(totExtra) : <span className="text-stone-300">—</span>}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums font-bold text-stone-900">{fmt(totAmt)}</td>
                              <td colSpan={2} />
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Extra jobs section */}
                      {stage.extraJobs.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                            Extra Jobs
                          </p>
                          <div className="rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100">
                            {stage.extraJobs.map((job) => (
                              <div key={job.id} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${selectedExtraJobs.has(job.id) ? 'bg-amber-50' : 'hover:bg-stone-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={selectedExtraJobs.has(job.id)}
                                  onChange={() => toggleExtraJobSelection(job.id)}
                                  className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                                />
                                <span className="text-sm text-stone-800 flex-1 truncate">{job.title}</span>
                                <span className="text-sm tabular-nums text-stone-600 shrink-0">
                                  {job.total > 0 ? fmt(job.total) : <span className="text-stone-300">—</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      </div>}{/* end isStageExpanded */}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}
    </div>
  )
}

function PdfIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
