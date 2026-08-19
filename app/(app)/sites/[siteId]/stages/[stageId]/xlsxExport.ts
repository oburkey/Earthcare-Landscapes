'use client'

import type { StageEstimateExport, StageEstimateExportLot } from './export-estimates-actions'

// ── Styles ────────────────────────────────────────────────────────────────────
// xlsx-js-style (not plain xlsx/SheetJS CE, which can't write cell styles) —
// see conversation for why. Style props mirror the OpenXML subset it supports:
// alignment, border, fill, font, numFmt.

const TITLE_STYLE = { font: { bold: true, sz: 13 } }
const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
  alignment: { vertical: 'center' },
}
const ROW_STYLE_EVEN = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } } }
const ROW_STYLE_ODD  = { fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } } }
const TOTALS_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
  border: { top: { style: 'medium', color: { rgb: '111827' } } },
}

const CURRENCY_FMT = '"$"#,##0.00'
const M2_FMT = '0.00'

const HEADERS = [
  'Lot', 'Design', 'Notes', 'Front m²', 'Rear m²', 'Total m²',
  'Cost per m²', 'Estimate', 'Contract Price', 'Actual', 'Client Extras', 'Total',
]
const NUM_COLS = HEADERS.length
const M2_COLS = new Set([3, 4, 5])
const CURRENCY_COLS = new Set([6, 7, 8, 9, 10, 11])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CellStyle = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XlsxUtils = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sheet = any

function setStyle(utils: XlsxUtils, ws: Sheet, r: number, c: number, style: CellStyle, fmt?: string) {
  const addr = utils.encode_cell({ r, c })
  if (!ws[addr]) ws[addr] = { t: 's', v: '' }
  ws[addr].s = style
  if (fmt) ws[addr].z = fmt
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Approximates Excel's "autofit" — widest cell content per column, in
// characters, clamped to a sane range (SheetJS CE has no true autofit API).
function computeColWidths(aoa: (string | number | null)[][]): { wch: number }[] {
  const widths = new Array(NUM_COLS).fill(6)
  for (const row of aoa) {
    for (let c = 0; c < NUM_COLS; c++) {
      const v = row[c]
      if (v == null) continue
      const len = String(v).length
      if (len > widths[c]) widths[c] = len
    }
  }
  return widths.map((w) => ({ wch: Math.min(Math.max(w + 2, 8), 40) }))
}

function sum(lots: StageEstimateExportLot[], f: (l: StageEstimateExportLot) => number): number {
  return lots.reduce((s, l) => s + f(l), 0)
}

export async function downloadStageEstimatesXlsx(data: StageEstimateExport): Promise<void> {
  const XLSX = await import('xlsx-js-style')
  const utils = XLSX.utils

  const { siteName, stageName, lots } = data
  const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })

  const aoa: (string | number | null)[][] = []

  // Title row
  aoa.push([`${stageName} LANDSCAPE ${siteName}`, ...Array(NUM_COLS - 1).fill(null)])
  const titleRow = aoa.length - 1

  // Header row
  aoa.push([...HEADERS])
  const headerRow = aoa.length - 1

  // One row per lot
  const lotRows: number[] = []
  for (const lot of lots) {
    aoa.push([
      lot.lotNumber, lot.homeDesign, lot.notes,
      lot.frontM2, lot.rearM2, lot.totalM2,
      lot.costPerM2,
      lot.budget, lot.contractPrice, lot.actual, lot.clientExtras, lot.total,
    ])
    lotRows.push(aoa.length - 1)
  }

  // Totals row
  const costPerM2Values = lots.map((l) => l.costPerM2).filter((v): v is number => v != null)
  const avgCostPerM2 = costPerM2Values.length > 0
    ? costPerM2Values.reduce((s, v) => s + v, 0) / costPerM2Values.length
    : null

  aoa.push([
    'TOTAL', null, null,
    sum(lots, (l) => l.frontM2), sum(lots, (l) => l.rearM2), sum(lots, (l) => l.totalM2),
    avgCostPerM2,
    sum(lots, (l) => l.budget), sum(lots, (l) => l.contractPrice ?? 0),
    sum(lots, (l) => l.actual), sum(lots, (l) => l.clientExtras), sum(lots, (l) => l.total),
  ])
  const totalsRow = aoa.length - 1

  const ws = utils.aoa_to_sheet(aoa)

  ws['!cols'] = computeColWidths(aoa)
  ws['!merges'] = [{ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: NUM_COLS - 1 } }]

  setStyle(utils, ws, titleRow, 0, TITLE_STYLE)
  for (let c = 0; c < NUM_COLS; c++) setStyle(utils, ws, headerRow, c, HEADER_STYLE)

  lotRows.forEach((r, i) => {
    const rowStyle = i % 2 === 0 ? ROW_STYLE_EVEN : ROW_STYLE_ODD
    for (let c = 0; c < NUM_COLS; c++) {
      const fmt = M2_COLS.has(c) ? M2_FMT : CURRENCY_COLS.has(c) ? CURRENCY_FMT : undefined
      setStyle(utils, ws, r, c, rowStyle, fmt)
    }
  })

  for (let c = 0; c < NUM_COLS; c++) {
    const fmt = M2_COLS.has(c) ? M2_FMT : CURRENCY_COLS.has(c) ? CURRENCY_FMT : undefined
    setStyle(utils, ws, totalsRow, c, TOTALS_STYLE, fmt)
  }

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Estimates')

  const filename = sanitizeFilename(`${stageName} Estimates ${dateStr}`) + '.xlsx'
  XLSX.writeFile(wb, filename)
}
