'use server'

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type StageEstimateExportLot = {
  lotNumber: string
  homeDesign: string | null
  notes: string | null
  frontM2: number
  rearM2: number
  totalM2: number
  costPerM2: number | null
  budget: number
  actual: number
  clientExtras: number
  total: number
}

export type StageEstimateExport = {
  siteName: string
  stageName: string
  lots: StageEstimateExportLot[]
}

// Item names counted toward Front/Rear m² — turf + ground-cover mulch/gravel
// types. Which of Front/Rear an item counts toward is decided by the
// section its template row lives in (real section names are
// "Hardscape Works — Front" / "Softscape Works — Front" / "Rear & Side Lot"
// — see app/(app)/analytics/lib.ts), so the same item name appearing in
// both a front and a rear section is attributed correctly per lot.
const M2_ITEM_NAMES = new Set([
  'Artificial Turf', 'Artificial turf',
  'Mulch Limestone 32mm', 'Limestone Mulch', 'Black Mulch',
  'Laterite compacted gravel', 'Laterite Gravel Mulch',
  'Recycled Brick',
])

type RawItem = {
  item_name: string
  quantity: number | null
  unit_price_snapshot: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote_template_items: any
}

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

function itemAmount(item: RawItem): number {
  const qty = Number(item.quantity ?? 0)
  const tpl = one(item.quote_template_items)
  const price = Number(item.unit_price_snapshot ?? tpl?.unit_price ?? 0)
  return qty * price
}

// is_client_extra on quote_template_sections is the authoritative Providence
// Works vs Client Extras flag used everywhere else in the app (invoices,
// analytics) — more reliable than string-matching the section name.
function isClientExtra(item: RawItem): boolean {
  const tpl = one(item.quote_template_items)
  const section = one(tpl?.quote_template_sections)
  return section?.is_client_extra ?? false
}

function sectionName(item: RawItem): string {
  const tpl = one(item.quote_template_items)
  const section = one(tpl?.quote_template_sections)
  return section?.name ?? ''
}

function m2Qty(items: RawItem[] | null | undefined, direction: 'Front' | 'Rear'): number {
  if (!items) return 0
  let total = 0
  for (const item of items) {
    const tpl = one(item.quote_template_items)
    const name = item.item_name || tpl?.name || ''
    if (!M2_ITEM_NAMES.has(name)) continue
    const sName = sectionName(item)
    if (!sName.includes(direction) && !name.includes(direction)) continue
    total += Number(item.quantity ?? 0)
  }
  return total
}

function providenceTotal(items: RawItem[] | null | undefined): number {
  if (!items) return 0
  return items.reduce((sum, item) => sum + (isClientExtra(item) ? 0 : itemAmount(item)), 0)
}

function clientExtrasTotal(items: RawItem[] | null | undefined): number {
  if (!items) return 0
  return items.reduce((sum, item) => sum + (isClientExtra(item) ? itemAmount(item) : 0), 0)
}

// Admin-only export — one summary row per lot: Providence Works Budget
// (estimate) vs Actual (final) vs Client Extras (final), plus front/rear m²
// derived from the estimate quant sheet. A lot is included if it has an
// estimate and/or a final quant sheet; lots with neither are skipped.
export async function getStageEstimatesExport(
  stageId: string
): Promise<{ data?: StageEstimateExport; error?: string }> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Only admins can export estimates.' }

  const supabase = await createClient()

  const { data: stage } = await supabase
    .from('stages')
    .select('name, sites!inner(name)')
    .eq('id', stageId)
    .single()
  if (!stage) return { error: 'Stage not found.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const site = Array.isArray(stage.sites) ? (stage.sites as any)[0] : (stage.sites as any)

  const ITEMS_SELECT = `
    item_name, quantity, unit_price_snapshot,
    quote_template_items(
      name, unit_price,
      quote_template_sections(name, is_client_extra)
    )
  `

  const { data: lots, error } = await supabase
    .from('lots')
    .select(`
      id, lot_number, home_design, notes,
      lot_quotes(quote_type, lot_quote_items(${ITEMS_SELECT}))
    `)
    .eq('stage_id', stageId)

  if (error) return { error: error.message }
  if (!lots || lots.length === 0) return { error: 'No lots found for this stage.' }

  const sortedLots = [...lots].sort((a, b) =>
    a.lot_number.localeCompare(b.lot_number, undefined, { numeric: true })
  )

  const result: StageEstimateExportLot[] = []

  for (const lot of sortedLots) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes = (lot.lot_quotes ?? []) as any[]
    const estimateQuote = quotes.find((q) => q.quote_type === 'estimate')
    const finalQuote = quotes.find((q) => q.quote_type === 'final')
    if (!estimateQuote && !finalQuote) continue

    const estimateItems = (estimateQuote?.lot_quote_items ?? []) as RawItem[]
    const finalItems = (finalQuote?.lot_quote_items ?? []) as RawItem[]

    const frontM2 = m2Qty(estimateItems, 'Front')
    const rearM2  = m2Qty(estimateItems, 'Rear')
    const totalM2 = frontM2 + rearM2

    const budget       = providenceTotal(estimateItems)
    const actual       = providenceTotal(finalItems)
    const clientExtras = clientExtrasTotal(finalItems)
    const total        = actual + clientExtras

    result.push({
      lotNumber: lot.lot_number,
      homeDesign: (lot as { home_design?: string | null }).home_design ?? null,
      notes: (lot as { notes?: string | null }).notes ?? null,
      frontM2, rearM2, totalM2,
      costPerM2: totalM2 > 0 ? actual / totalM2 : null,
      budget, actual, clientExtras, total,
    })
  }

  if (result.length === 0) return { error: 'No estimate or final quant sheets found for this stage.' }

  return {
    data: {
      siteName: site?.name ?? '',
      stageName: stage.name,
      lots: result,
    },
  }
}
