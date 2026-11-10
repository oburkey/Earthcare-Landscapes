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

const DETAIL_SHEET = 'Estimates'
const SUMMARY_SHEET = 'Client Summary'

const HEADERS = [
  'Lot', 'Design', 'Notes', 'Front m²', 'Rear m²', 'Total m²',
  'Cost per m²', 'Estimate', 'Contract Price', 'Actual', 'Client Extras', 'Total',
]
const NUM_COLS = HEADERS.length
const M2_COLS = new Set([3, 4, 5])
const CURRENCY_COLS = new Set([6, 7, 8, 9, 10, 11])

// Detailed sheet column letters, used in formulas
const COL = {
  lot: 'A', design: 'B', front: 'D', rear: 'E', totalM2: 'F', costPerM2: 'G',
  estimate: 'H', contract: 'I', actual: 'J', extras: 'K', total: 'L',
} as const

// ── Client Summary styles ─────────────────────────────────────────────────────

const THIN   = { style: 'thin',   color: { rgb: '000000' } }
const MEDIUM = { style: 'medium', color: { rgb: '000000' } }
const SUMMARY_HEADERS = ['Lot', 'Design', 'Notes', 'Budget', 'Total Amount']
const SUMMARY_NUM_COLS = SUMMARY_HEADERS.length
const SUMMARY_CURRENCY_COLS = new Set([3, 4])
const SUMMARY_COL_WIDTHS = [18, 21, 12, 16, 16]
const SUMMARY_TITLE_STYLE = { font: { bold: true, sz: 13 } }
const SUMMARY_HEADER_STYLE = HEADER_STYLE
const SUMMARY_ROW_STYLE = {}
const SUMMARY_TOTALS_STYLE = { font: { bold: true } }

// Medium around the whole table, under the title, under the header and above
// TOTAL; thin everywhere else. Each side is set on both neighbouring cells so
// Excel draws it the same whichever cell it reads.
function summaryBorder(r: number, c: number, totalsRow: number) {
  const mediumBelow = (row: number) => row === 0 || row === 1 || row === totalsRow - 1 || row === totalsRow
  return {
    top:    r === 0 || mediumBelow(r - 1) ? MEDIUM : THIN,
    bottom: mediumBelow(r) ? MEDIUM : THIN,
    left:   c === 0 ? MEDIUM : THIN,
    right:  c === SUMMARY_NUM_COLS - 1 ? MEDIUM : THIN,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CellStyle = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XlsxModule = any
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

// Formula cell. `cached` is the value it works out to now, so viewers that
// don't recalculate (iPad preview, email previews) still show the figure;
// Excel recalculates from the formula.
function setFormula(utils: XlsxUtils, ws: Sheet, r: number, c: number, formula: string, cached: string | number | null) {
  const addr = utils.encode_cell({ r, c })
  ws[addr] = typeof cached === 'number'
    ? { t: 'n', v: cached, f: formula }
    : { t: 's', v: cached ?? '', f: formula }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim()
}

// How a number shows once formatted ("$10,700.00" / "12.50"), so the width
// fits the displayed text — measuring the raw 10700 left Total too narrow
// (########).
function displayText(v: string | number, c: number): string {
  if (typeof v !== 'number') return v
  if (CURRENCY_COLS.has(c)) return '$' + v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (M2_COLS.has(c)) return v.toFixed(2)
  return String(v)
}

// Approximates Excel's "autofit" — widest cell content per column, in
// characters, clamped to a sane range (SheetJS CE has no true autofit API).
function computeColWidths(aoa: (string | number | null)[][]): { wch: number }[] {
  const widths = new Array(NUM_COLS).fill(6)
  for (const row of aoa) {
    for (let c = 0; c < NUM_COLS; c++) {
      const v = row[c]
      if (v == null) continue
      const len = displayText(v, c).length
      if (len > widths[c]) widths[c] = len
    }
  }
  return widths.map((w) => ({ wch: Math.min(Math.max(w + 2, 8), 40) }))
}

function sum(lots: StageEstimateExportLot[], f: (l: StageEstimateExportLot) => number): number {
  return lots.reduce((s, l) => s + f(l), 0)
}

// ── Sheet 1: Estimates (detailed) ─────────────────────────────────────────────
// Lot inputs (m², Estimate, Contract Price, Actual, Client Extras) are values;
// Total m², Cost per m², Total and the TOTAL row are formulas, so editing an
// input recalculates everything after it, including Client Summary.

function buildDetailSheet(utils: XlsxUtils, data: StageEstimateExport): { ws: Sheet; lotExcelRows: number[] } {
  const { siteName, stageName, lots } = data
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

  // Formulas (Excel rows are 1-based)
  const lotExcelRows = lotRows.map((r) => r + 1)
  lots.forEach((lot, i) => {
    const r = lotRows[i]
    const n = lotExcelRows[i]
    setFormula(utils, ws, r, 5, `${COL.front}${n}+${COL.rear}${n}`, lot.totalM2)
    setFormula(utils, ws, r, 6, `IF(${COL.totalM2}${n}>0,${COL.estimate}${n}/${COL.totalM2}${n},"")`, lot.costPerM2)
    // Contract-priced lots: Total = contract price only (lib/lotTotals.ts)
    setFormula(utils, ws, r, 11, `IF(${COL.contract}${n}<>"",${COL.contract}${n},${COL.actual}${n}+${COL.extras}${n})`, lot.total)
  })

  const first = lotExcelRows[0]
  const last  = lotExcelRows[lotExcelRows.length - 1]
  const totalsValues = aoa[totalsRow]
  for (const c of [3, 4, 5, 7, 8, 9, 10, 11]) {
    const letter = utils.encode_col(c)
    setFormula(utils, ws, totalsRow, c, `SUM(${letter}${first}:${letter}${last})`, totalsValues[c])
  }
  setFormula(utils, ws, totalsRow, 6, `IFERROR(AVERAGE(${COL.costPerM2}${first}:${COL.costPerM2}${last}),"")`, avgCostPerM2)

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

  return { ws, lotExcelRows }
}

// ── Sheet 2: Client Summary ───────────────────────────────────────────────────
// Every figure is a formula on the Estimates sheet. Budget = Contract Price
// (the lot's own price, else the stage default — the Providence Works
// budget). Total Amount = Estimate + Client Extras, both from the estimate
// quant sheet, even for contract-priced lots. Notes is plain text from the
// lot's corner flag.

function buildSummarySheet(utils: XlsxUtils, data: StageEstimateExport, detailRows: number[]): Sheet {
  const { siteName, stageName, lots } = data
  const ref = (col: string, n: number) => `'${DETAIL_SHEET}'!${col}${n}`

  const aoa: (string | number | null)[][] = [
    [`${stageName} LANDSCAPE ${siteName}`, ...Array(SUMMARY_NUM_COLS - 1).fill(null)],
    [...SUMMARY_HEADERS],
    ...lots.map(() => Array(SUMMARY_NUM_COLS).fill(null)),
    ['TOTAL', null, null, null, null],
  ]
  const ws = utils.aoa_to_sheet(aoa)

  const firstLotRow = 2
  lots.forEach((lot, i) => {
    const r = firstLotRow + i
    const n = detailRows[i]
    // Lot references a text cell, so leading zeros stay (003)
    setFormula(utils, ws, r, 0, ref(COL.lot, n), lot.lotNumber)
    setFormula(utils, ws, r, 1, `UPPER(${ref(COL.design, n)})`, (lot.homeDesign ?? '').toUpperCase())
    if (lot.isCorner) ws[utils.encode_cell({ r, c: 2 })] = { t: 's', v: 'Corner' }
    setFormula(utils, ws, r, 3, ref(COL.contract, n), lot.contractPrice)
    setFormula(utils, ws, r, 4, `${ref(COL.estimate, n)}+${ref(COL.extras, n)}`, lot.budget + lot.clientExtras)
  })

  const totalsRow = firstLotRow + lots.length
  const first = firstLotRow + 1
  const last  = totalsRow
  setFormula(utils, ws, totalsRow, 3, `SUM(D${first}:D${last})`, sum(lots, (l) => l.contractPrice ?? 0))
  setFormula(utils, ws, totalsRow, 4, `SUM(E${first}:E${last})`, sum(lots, (l) => l.budget + l.clientExtras))

  ws['!cols'] = SUMMARY_COL_WIDTHS.map((wch) => ({ wch }))
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: SUMMARY_NUM_COLS - 1 } }]

  for (let c = 0; c < SUMMARY_NUM_COLS; c++) {
    const fmt = SUMMARY_CURRENCY_COLS.has(c) ? CURRENCY_FMT : undefined
    const withBorder = (style: CellStyle, r: number) => ({ ...style, border: summaryBorder(r, c, totalsRow) })
    setStyle(utils, ws, 0, c, withBorder(SUMMARY_TITLE_STYLE, 0))
    setStyle(utils, ws, 1, c, withBorder(SUMMARY_HEADER_STYLE, 1))
    for (let r = firstLotRow; r < totalsRow; r++) setStyle(utils, ws, r, c, withBorder(SUMMARY_ROW_STYLE, r), fmt)
    setStyle(utils, ws, totalsRow, c, withBorder(SUMMARY_TOTALS_STYLE, totalsRow), fmt)
  }

  return ws
}

// Builds the workbook without downloading it (kept separate so it can be
// checked outside the browser).
export function buildStageEstimatesWorkbook(XLSX: XlsxModule, data: StageEstimateExport) {
  const utils = XLSX.utils
  const { ws: detail, lotExcelRows } = buildDetailSheet(utils, data)
  const summary = buildSummarySheet(utils, data, lotExcelRows)

  const wb = utils.book_new()
  utils.book_append_sheet(wb, detail, DETAIL_SHEET)
  utils.book_append_sheet(wb, summary, SUMMARY_SHEET)
  return wb
}

export async function downloadStageEstimatesXlsx(data: StageEstimateExport): Promise<void> {
  const XLSX = await import('xlsx-js-style')
  const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
  const wb = buildStageEstimatesWorkbook(XLSX, data)
  const filename = sanitizeFilename(`${data.stageName} Estimates ${dateStr}`) + '.xlsx'
  XLSX.writeFile(wb, filename)
}
