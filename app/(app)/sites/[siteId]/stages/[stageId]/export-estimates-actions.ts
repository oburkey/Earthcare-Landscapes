'use server'

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type StageEstimateExportItem = {
  key: string
  name: string
  unit: string
  orderIndex: number
  rate: number | null
  qtyByLot: Record<string, number>
}

export type StageEstimateExportSection = {
  key: string
  name: string
  orderIndex: number
  items: StageEstimateExportItem[]
}

export type StageEstimateExport = {
  siteName: string
  stageName: string
  lotNumbers: string[]
  sections: StageEstimateExportSection[]
  lotTotals: Record<string, number>
  grandTotal: number
}

// Admin-only export of every lot's ESTIMATE quant sheet in a stage, shaped
// into a section -> item -> per-lot-quantity matrix for the Excel export.
// Only items with a non-zero quantity become rows (matches the convention
// used elsewhere — e.g. invoices/page.tsx's buildSections — of only showing
// what was actually entered, not every possible template item).
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

  // lot_quotes!inner + the nested .eq() below restrict to lots that actually
  // have an estimate quant sheet — lots without one simply don't appear.
  const { data: lots, error } = await supabase
    .from('lots')
    .select(`
      id, lot_number,
      lot_quotes!inner(
        quote_type,
        lot_quote_items(
          item_name, unit, quantity, unit_price_snapshot, template_item_id,
          quote_template_items(
            name, unit, unit_price, order_index, section_id,
            quote_template_sections(name, order_index)
          )
        )
      )
    `)
    .eq('stage_id', stageId)
    .eq('lot_quotes.quote_type', 'estimate')

  if (error) return { error: error.message }
  if (!lots || lots.length === 0) return { error: 'No estimate quant sheets found for this stage.' }

  const sortedLots = [...lots].sort((a, b) =>
    a.lot_number.localeCompare(b.lot_number, undefined, { numeric: true })
  )
  const lotNumbers = sortedLots.map((l) => l.lot_number)

  const sectionMap = new Map<string, StageEstimateExportSection>()
  const lotTotals: Record<string, number> = {}

  for (const lot of sortedLots) {
    lotTotals[lot.lot_number] = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes = (lot.lot_quotes ?? []) as any[]
    const estimateQuote = quotes[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (estimateQuote?.lot_quote_items ?? []) as any[]

    for (const item of items) {
      const qty = Number(item.quantity ?? 0)
      if (!qty) continue

      const tpl = Array.isArray(item.quote_template_items) ? item.quote_template_items[0] : item.quote_template_items
      const section = tpl
        ? (Array.isArray(tpl.quote_template_sections) ? tpl.quote_template_sections[0] : tpl.quote_template_sections)
        : null

      const rate: number | null = item.unit_price_snapshot ?? tpl?.unit_price ?? null
      lotTotals[lot.lot_number] += qty * (rate ?? 0)

      const sectionKey = tpl?.section_id ?? '__other__'
      const sectionName = section?.name ?? 'Other'
      const sectionOrder = section?.order_index ?? 999

      const itemKey = item.template_item_id ?? item.item_name
      const itemName = item.item_name || tpl?.name || ''
      const unit = item.unit || tpl?.unit || ''
      const itemOrder = tpl?.order_index ?? 999

      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, { key: sectionKey, name: sectionName, orderIndex: sectionOrder, items: [] })
      }
      const sec = sectionMap.get(sectionKey)!
      let row = sec.items.find((i) => i.key === itemKey)
      if (!row) {
        row = { key: itemKey, name: itemName, unit, orderIndex: itemOrder, rate: null, qtyByLot: {} }
        sec.items.push(row)
      }
      if (row.rate == null && rate != null) row.rate = rate
      row.qtyByLot[lot.lot_number] = qty
    }
  }

  const sections = [...sectionMap.values()]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((s) => ({ ...s, items: [...s.items].sort((a, b) => a.orderIndex - b.orderIndex) }))

  const grandTotal = Object.values(lotTotals).reduce((sum, v) => sum + v, 0)

  return {
    data: {
      siteName: site?.name ?? '',
      stageName: stage.name,
      lotNumbers,
      sections,
      lotTotals,
      grandTotal,
    },
  }
}
