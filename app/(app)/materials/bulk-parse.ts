// Parses supplier-format bulk plant lines, e.g.:
//   "12 x Callistemon 'Four Seasons' in 140mm Pot"
//   "6 x Dianella 'Little Rev' in 35 Litre Pot"
// into structured rows the Orders tab can preview before adding to an order.
// Pure functions — no 'use server', safe to import from a client component.

export const POT_SIZE_TO_CATEGORY: Record<string, string> = {
  '140mm': '140mm',
  '200mm': '200mm',
  '300mm': '300mm',
  '35 Litre': '35 Litre',
  '90 Litre': '90 Litre',
}

const BULK_LINE_RE = /^\s*(\d+)\s*x\s*(.+?)\s+in\s+(\d+)\s*(mm|l|litre)s?\s*pot\s*$/i

export type ParsedBulkLine = {
  raw: string
  quantity: number
  speciesName: string
  potSize: string
  category: string
}

export type BulkParseError = {
  raw: string
  error: string
}

export type BulkParseResult = ParsedBulkLine | BulkParseError

function potSizeToCategory(numStr: string, unit: string): string | null {
  const num = parseInt(numStr, 10)
  const u = unit.toLowerCase()
  if (u === 'mm') {
    if (num === 140) return '140mm'
    if (num === 200) return '200mm'
    if (num === 300) return '300mm'
    return null
  }
  if (num === 35) return '35 Litre'
  if (num === 90) return '90 Litre'
  return null
}

export function parseBulkPlantLine(line: string): BulkParseResult {
  const raw = line.trim()
  if (!raw) return { raw, error: 'Empty line' }

  const match = BULK_LINE_RE.exec(raw)
  if (!match) {
    return { raw, error: `Couldn't parse — expected format like "12 x Species Name in 140mm Pot"` }
  }

  const [, qtyStr, speciesName, sizeNum, sizeUnit] = match
  const quantity = parseInt(qtyStr, 10)
  const category = potSizeToCategory(sizeNum, sizeUnit)

  if (!category) {
    return { raw, error: `Unrecognized pot size "${sizeNum}${sizeUnit}" — add this line manually` }
  }

  return {
    raw,
    quantity,
    speciesName: speciesName.trim(),
    potSize: category,
    category,
  }
}

export function parseBulkPlantText(text: string): BulkParseResult[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseBulkPlantLine)
}

export function isParsedLine(result: BulkParseResult): result is ParsedBulkLine {
  return !('error' in result)
}
