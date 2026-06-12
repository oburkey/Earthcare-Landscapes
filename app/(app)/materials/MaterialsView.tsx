'use client'

import { useState } from 'react'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'
import type { MonthMaterialGroup, SiteMaterialGroup } from './lib'

// ── Formatting helpers ───────────────────────────────────────────────────────

function fmtM2(n: number): string {
  return n.toLocaleString('en-AU', { maximumFractionDigits: 1, minimumFractionDigits: 0 })
}

function potSplitText(group: SiteMaterialGroup): string {
  return group.totals.potSplit
    .map((p) => `${p.pct}% ${p.label} (${p.count})`)
    .join(', ')
}

// ── PDF export ────────────────────────────────────────────────────────────────

const PDF_STYLES = `
<style>
.html2pdf__container * { box-sizing: border-box; margin: 0; padding: 0; }
.html2pdf__container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: white; }
.html2pdf__container .pdf-page { padding: 24px 28px; }
.html2pdf__container .month-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #ddd; }
.html2pdf__container .doc-hdr { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid #111; }
.html2pdf__container .doc-hdr-left .main-label { font-size: 22px; font-weight: bold; letter-spacing: 0.03em; margin-bottom: 4px; }
.html2pdf__container .doc-hdr-left .sub { font-size: 10px; color: #555; }
.html2pdf__container .doc-hdr-right img { max-width: 130px; max-height: 55px; object-fit: contain; display: block; }
.html2pdf__container .site-block { margin-top: 14px; }
.html2pdf__container .site-title { font-size: 13px; font-weight: bold; color: #111; margin-bottom: 4px; }
.html2pdf__container .site-summary { font-size: 10px; color: #444; margin-bottom: 6px; line-height: 1.5; }
.html2pdf__container table { width: 100%; border-collapse: collapse; }
.html2pdf__container thead th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; padding: 5px 6px; border-bottom: 2px solid #bbb; text-align: left; white-space: nowrap; }
.html2pdf__container thead th.r { text-align: right; }
.html2pdf__container td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
.html2pdf__container td.r { text-align: right; white-space: nowrap; }
.html2pdf__container tr.sub td { background: #fafafa; font-weight: 600; border-top: 1px solid #ddd; border-bottom: 2px solid #ccc; }
.html2pdf__container .note { margin-top: 14px; font-size: 9px; color: #999; }
</style>`

function buildMonthHtml(month: MonthMaterialGroup, isFirst: boolean, logoSrc: string, date: string): string {
  const siteBlocks = month.sites.map((site) => {
    const lotRows = site.lots.map((lot) => `
      <tr>
        <td>Lot ${lot.lotNumber}</td>
        <td class="r">${fmtM2(lot.frontM2)}</td>
        <td class="r">${fmtM2(lot.rearM2)}</td>
        <td class="r">${lot.totalPlants}</td>
        <td class="r">${lot.streetTrees90L > 0 ? lot.streetTrees90L : '—'}</td>
      </tr>`).join('')

    const jobRows = site.extraJobs.map((job) => `
      <tr>
        <td>Extra job — ${job.title}</td>
        <td class="r">${fmtM2(job.frontM2)}</td>
        <td class="r">${fmtM2(job.rearM2)}</td>
        <td class="r">${job.totalPlants}</td>
        <td class="r">${job.streetTrees90L > 0 ? job.streetTrees90L : '—'}</td>
      </tr>`).join('')

    const summaryParts = [
      `Front ${fmtM2(site.totals.frontM2)} m² · Rear ${fmtM2(site.totals.rearM2)} m²`,
      `Plants: ${site.totals.totalPlants} (front ${site.totals.frontPlants} / rear ${site.totals.rearPlants})`,
    ]
    if (site.totals.potSplit.length > 0) summaryParts.push(`Pot sizes: ${potSplitText(site)}`)
    if (site.totals.streetTrees90L > 0) summaryParts.push(`Street trees (90L): ${site.totals.streetTrees90L}`)

    return `
    <div class="site-block">
      <div class="site-title">${site.siteName}</div>
      <div class="site-summary">${summaryParts.join(' &nbsp;·&nbsp; ')}</div>
      <table>
        <thead>
          <tr><th>Lot</th><th class="r">Front m²</th><th class="r">Rear m²</th><th class="r">Plants</th><th class="r">Street trees 90L</th></tr>
        </thead>
        <tbody>
          ${lotRows}${jobRows}
          <tr class="sub">
            <td>Total</td>
            <td class="r">${fmtM2(site.totals.frontM2)}</td>
            <td class="r">${fmtM2(site.totals.rearM2)}</td>
            <td class="r">${site.totals.totalPlants}</td>
            <td class="r">${site.totals.streetTrees90L > 0 ? site.totals.streetTrees90L : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>`
  }).join('')

  return `<div${isFirst ? '' : ' class="month-section"'}>
    ${isFirst ? `
    <div class="doc-hdr">
      <div class="doc-hdr-left">
        <div class="main-label">Materials Plan</div>
        <div class="sub">${date}</div>
      </div>
      <div class="doc-hdr-right">
        ${logoSrc ? `<img src="${logoSrc}" alt="Earthcare Landscapes" />` : ''}
      </div>
    </div>` : `<div class="site-title" style="font-size:15px;margin-bottom:8px">${month.label}</div>`}
    ${isFirst ? `<div class="site-title" style="font-size:15px;margin:8px 0">${month.label}</div>` : ''}
    ${month.sites.length === 0
      ? '<div class="site-summary" style="font-style:italic;color:#999">No lots or extra jobs due this month.</div>'
      : siteBlocks}
  </div>`
}

function buildMaterialsPdfHtml(months: MonthMaterialGroup[], logoSrc: string): string {
  const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const sections = months.map((m, idx) => buildMonthHtml(m, idx === 0, logoSrc, date)).join('')
  return `${PDF_STYLES}
<div class="pdf-page">
  ${sections}
  <div class="note">Plant counts are estimates derived from estimate quant sheets and configured plant ratios.</div>
</div>`
}

async function downloadPDF(contentHtml: string, filename: string, onError: (msg: string) => void, onDone: () => void) {
  const el = document.createElement('div')
  el.innerHTML = contentHtml
  try {
    const { default: html2pdf } = await import('html2pdf.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (html2pdf() as any)
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(el)
      .save()
  } catch {
    onError('Failed to generate PDF. Please try again.')
  } finally {
    onDone()
  }
}

// ── Site card ────────────────────────────────────────────────────────────────

function SiteCard({ site, lotSitePlanUrls }: { site: SiteMaterialGroup; lotSitePlanUrls: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">{site.siteName}</h3>
          <p className="mt-1 text-xs text-stone-500">
            Front {fmtM2(site.totals.frontM2)} m² · Rear {fmtM2(site.totals.rearM2)} m²
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Plants: <span className="font-medium text-stone-700">{site.totals.totalPlants}</span>
            {' '}(front {site.totals.frontPlants} / rear {site.totals.rearPlants})
          </p>
          {site.totals.potSplit.length > 0 && (
            <p className="mt-1 text-xs text-stone-500">Pot sizes: {potSplitText(site)}</p>
          )}
          {site.totals.streetTrees90L > 0 && (
            <p className="mt-1 text-xs text-stone-500">Street trees (90L): {site.totals.streetTrees90L}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
        >
          {expanded ? 'Hide detail' : 'Show detail'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-stone-100 pt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-stone-400">
                <th className="text-left font-medium pb-1 pr-2">Lot</th>
                <th className="text-right font-medium pb-1 pr-2">Front m²</th>
                <th className="text-right font-medium pb-1 pr-2">Rear m²</th>
                <th className="text-right font-medium pb-1 pr-2">Plants</th>
                <th className="text-right font-medium pb-1 pr-2">Street trees 90L</th>
                <th className="pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {site.lots.map((lot) => (
                <tr key={lot.id} className="border-t border-stone-100">
                  <td className="py-1 pr-2 text-stone-700">Lot {lot.lotNumber}</td>
                  <td className="py-1 pr-2 text-right text-stone-600">{fmtM2(lot.frontM2)}</td>
                  <td className="py-1 pr-2 text-right text-stone-600">{fmtM2(lot.rearM2)}</td>
                  <td className="py-1 pr-2 text-right text-stone-600">{lot.totalPlants}</td>
                  <td className="py-1 pr-2 text-right text-stone-600">{lot.streetTrees90L > 0 ? lot.streetTrees90L : '—'}</td>
                  <td className="py-1 text-right">
                    {lotSitePlanUrls[lot.id] && (
                      <a href={lotSitePlanUrls[lot.id]} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">
                        Site plan
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {site.extraJobs.map((job) => (
                <tr key={job.id} className="border-t border-stone-100">
                  <td className="py-1 pr-2 text-stone-700">Extra job — {job.title}</td>
                  <td className="py-1 pr-2 text-right text-stone-600">{fmtM2(job.frontM2)}</td>
                  <td className="py-1 pr-2 text-right text-stone-600">{fmtM2(job.rearM2)}</td>
                  <td className="py-1 pr-2 text-right text-stone-600">{job.totalPlants}</td>
                  <td className="py-1 pr-2 text-right text-stone-600">{job.streetTrees90L > 0 ? job.streetTrees90L : '—'}</td>
                  <td className="py-1"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MaterialsView({ months, lotSitePlanUrls }: {
  months: MonthMaterialGroup[]
  lotSitePlanUrls: Record<string, string>
}) {
  const [error, setError] = useState<string | null>(null)
  const [exportingKey, setExportingKey] = useState<string | null>(null)

  function exportMonth(month: MonthMaterialGroup) {
    setError(null)
    setExportingKey(month.key)
    const html = buildMaterialsPdfHtml([month], LOGO_DATA_URL)
    downloadPDF(html, `materials-${month.key}.pdf`, setError, () => setExportingKey(null))
  }

  function exportAll() {
    setError(null)
    setExportingKey('all')
    const html = buildMaterialsPdfHtml(months, LOGO_DATA_URL)
    downloadPDF(html, 'materials-plan.pdf', setError, () => setExportingKey(null))
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportAll}
          disabled={exportingKey !== null}
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {exportingKey === 'all' ? 'Generating…' : 'Export all (PDF)'}
        </button>
      </div>

      {months.map((month) => (
        <div key={month.key} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-800">{month.label}</h2>
            <button
              type="button"
              onClick={() => exportMonth(month)}
              disabled={exportingKey !== null}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
            >
              {exportingKey === month.key ? 'Generating…' : 'Export PDF'}
            </button>
          </div>

          {month.sites.length === 0 ? (
            <p className="text-sm text-stone-400">No lots or extra jobs due this month.</p>
          ) : (
            <div className="space-y-3">
              {month.sites.map((site) => (
                <SiteCard key={site.siteId} site={site} lotSitePlanUrls={lotSitePlanUrls} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
