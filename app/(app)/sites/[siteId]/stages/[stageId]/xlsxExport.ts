'use client'

import type { StageEstimateExport } from './export-estimates-actions'

// ── Styles ────────────────────────────────────────────────────────────────────
// xlsx-js-style (not plain xlsx/SheetJS CE, which can't write cell styles) —
// see conversation for why. Style props mirror the OpenXML subset it supports:
// alignment, border, fill, font, numFmt.

const TITLE_STYLE = { font: { bold: true, sz: 13 } }
const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: '374151' } },
  alignment: { vertical: 'center' },
}
const SECTION_STYLE = {
  font: { bold: true, sz: 12 },
  fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
}
const SUBTOTAL_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
  border: { top: { style: 'thin', color: { rgb: 'D1D5DB' } } },
}
const SUMMARY_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'ECFDF5' } },
}
const GRAND_TOTAL_STYLE = {
  font: { bold: true, sz: 12 },
  fill: { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } },
  border: { top: { style: 'medium', color: { rgb: '111827' } } },
}

const CURRENCY_FMT = '"$"#,##0.00'
const QTY_FMT = '#,##0.###'

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

export async function downloadStageEstimatesXlsx(data: StageEstimateExport): Promise<void> {
  const XLSX = await import('xlsx-js-style')
  const utils = XLSX.utils

  const { siteName, stageName, lotNumbers, sections, lotTotals, grandTotal } = data
  const lotColStart = 4                       // 0: Section, 1: Item, 2: Unit, 3: Rate
  const totalCol = lotColStart + lotNumbers.length
  const lastCol = totalCol

  const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })

  const aoa: (string | number | null)[][] = []

  // Title row
  aoa.push([`${siteName} — ${stageName} — Estimates — ${dateStr}`])
  const titleRow = aoa.length - 1

  // Header
  aoa.push(['Section', 'Item', 'Unit', 'Rate', ...lotNumbers.map((n) => `Lot ${n}`), 'Total'])
  const headerRow = aoa.length - 1

  // Per-lot summary row
  aoa.push([
    'Total (ex GST)', null, null, null,
    ...lotNumbers.map((n) => lotTotals[n] ?? 0),
    grandTotal,
  ])
  const summaryRow = aoa.length - 1

  // Spacer
  aoa.push([])

  const sectionBannerRows: number[] = []
  const subtotalRows: number[] = []
  const itemRows: number[] = []

  for (const section of sections) {
    aoa.push([section.name, ...Array(lastCol).fill(null)])
    sectionBannerRows.push(aoa.length - 1)

    let sectionTotal = 0
    for (const item of section.items) {
      const totalQty = Object.values(item.qtyByLot).reduce((s, v) => s + v, 0)
      const itemTotal = (item.rate ?? 0) * totalQty
      sectionTotal += itemTotal
      aoa.push([
        null, item.name, item.unit, item.rate,
        ...lotNumbers.map((n) => item.qtyByLot[n] ?? null),
        itemTotal,
      ])
      itemRows.push(aoa.length - 1)
    }

    aoa.push(['Subtotal', ...Array(lastCol - 1).fill(null), sectionTotal])
    subtotalRows.push(aoa.length - 1)
  }

  aoa.push(['Grand Total (ex GST)', ...Array(lastCol - 1).fill(null), grandTotal])
  const grandTotalRow = aoa.length - 1

  const ws = utils.aoa_to_sheet(aoa)

  // Column widths
  ws['!cols'] = [
    { wch: 24 }, { wch: 34 }, { wch: 8 }, { wch: 10 },
    ...lotNumbers.map(() => ({ wch: 11 })),
    { wch: 13 },
  ]

  // Merges
  ws['!merges'] = [
    { s: { r: titleRow, c: 0 }, e: { r: titleRow, c: lastCol } },
    { s: { r: summaryRow, c: 0 }, e: { r: summaryRow, c: 3 } },
    ...sectionBannerRows.map((r) => ({ s: { r, c: 0 }, e: { r, c: lastCol } })),
    ...subtotalRows.map((r) => ({ s: { r, c: 0 }, e: { r, c: lastCol - 1 } })),
    { s: { r: grandTotalRow, c: 0 }, e: { r: grandTotalRow, c: lastCol - 1 } },
  ]

  // Styles + number formats
  setStyle(utils, ws, titleRow, 0, TITLE_STYLE)
  for (let c = 0; c <= lastCol; c++) setStyle(utils, ws, headerRow, c, HEADER_STYLE)
  for (let c = 0; c <= lastCol; c++) {
    setStyle(utils, ws, summaryRow, c, SUMMARY_STYLE, c >= lotColStart ? CURRENCY_FMT : undefined)
  }
  for (const r of sectionBannerRows) {
    for (let c = 0; c <= lastCol; c++) setStyle(utils, ws, r, c, SECTION_STYLE)
  }
  for (const r of itemRows) {
    setStyle(utils, ws, r, 3, {}, CURRENCY_FMT)
    for (let c = lotColStart; c < totalCol; c++) setStyle(utils, ws, r, c, {}, QTY_FMT)
    setStyle(utils, ws, r, totalCol, {}, CURRENCY_FMT)
  }
  for (const r of subtotalRows) {
    for (let c = 0; c <= lastCol; c++) setStyle(utils, ws, r, c, SUBTOTAL_STYLE, c === lastCol ? CURRENCY_FMT : undefined)
  }
  for (let c = 0; c <= lastCol; c++) {
    setStyle(utils, ws, grandTotalRow, c, GRAND_TOTAL_STYLE, c === lastCol ? CURRENCY_FMT : undefined)
  }

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Estimates')

  const filename = sanitizeFilename(`${stageName} Estimates ${dateStr}`) + '.xlsx'
  XLSX.writeFile(wb, filename)
}
