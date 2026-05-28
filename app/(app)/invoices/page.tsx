import { requireAuth, requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import InvoicesView from './InvoicesView'
import type { SiteData, StageData, LotRow, LotSection } from './InvoicesView'

export const metadata = { title: 'Invoices — Earthcare Landscapes' }

export default async function InvoicesPage() {
  const profile = await requireAuth()
  requireRole(profile, 'admin')

  const supabase = await createClient()

  // ── Query 1: Sites → stages → lots ───────────────────────────────────────
  const { data: sitesRaw } = await supabase
    .from('sites')
    .select(`
      id, name, client_contact, completed_at, has_client_extras,
      stages(id, name, order,
        lots(id, lot_number, build_complete, quant_done, invoiced, has_client_extras)
      )
    `)
    .order('name')

  // Filter to active (non-completed) sites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeSites = (sitesRaw ?? []).filter((s: any) => !s.completed_at)

  // Collect qualifying lot IDs (build_complete OR quant_done)
  const qualifyingLotIds: string[] = []
  for (const site of activeSites) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const stage of (site.stages ?? []) as any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const lot of (stage.lots ?? []) as any[]) {
        if (lot.build_complete || lot.quant_done) {
          qualifyingLotIds.push(lot.id)
        }
      }
    }
  }

  // ── Query 2: All quotes for qualifying lots (best quote per lot selected in JS) ──
  // Scoring: approved > submitted > draft; final > estimated (matching MaterialsSummary logic)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function bestQuoteScore(q: any): number {
    const statusScore = q.status === 'approved' ? 3 : q.status === 'submitted' ? 2 : 1
    const typeScore   = q.is_estimated ? 0 : 1   // final preferred over estimated
    return statusScore * 10 + typeScore
  }

  type AmountData = { standard: number; extras: number; sections: LotSection[] }
  const amountByLot = new Map<string, AmountData>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildSections(items: any[]): { standard: number; extras: number; sections: LotSection[] } {
    // Group items by section_id, compute amounts, sort for PDF output
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectionMap = new Map<string, any>()
    let standard = 0, extras = 0

    for (const item of items) {
      const qty = Number(item.quantity ?? 0)
      const price = Number(
        item.unit_price_snapshot
        ?? item.quote_template_items?.unit_price
        ?? 0
      )
      const amount = qty * price
      const isExtra: boolean =
        item.quote_template_items?.quote_template_sections?.is_client_extra ?? false
      const sectionId: string =
        item.quote_template_items?.section_id ?? '__other__'
      const sectionName: string =
        item.quote_template_items?.quote_template_sections?.name ?? 'Other'
      const sectionOrder: number =
        item.quote_template_items?.quote_template_sections?.order_index ?? 999
      const itemOrder: number =
        item.quote_template_items?.order_index ?? 999

      if (isExtra) extras += amount
      else standard += amount

      if (qty === 0) continue  // zero-qty items don't appear in PDF

      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, { name: sectionName, isClientExtra: isExtra, orderIndex: sectionOrder, items: [] })
      }
      sectionMap.get(sectionId).items.push({
        name:      item.item_name || item.quote_template_items?.name || '',
        quantity:  qty,
        unit:      item.unit || item.quote_template_items?.unit || '',
        rate:      price,
        total:     amount,
        orderIndex: itemOrder,
      })
    }

    const sections: LotSection[] = [...sectionMap.values()]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sortedItems = [...s.items].sort((a: any, b: any) => a.orderIndex - b.orderIndex)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subtotal = sortedItems.reduce((sum: number, i: any) => sum + i.total, 0)
        return {
          id:            s.name,
          name:          s.name,
          isClientExtra: s.isClientExtra,
          orderIndex:    s.orderIndex,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items:         sortedItems.map((i: any) => ({
            name:     i.name,
            quantity: i.quantity,
            unit:     i.unit,
            rate:     i.rate,
            total:    i.total,
          })),
          subtotal,
        }
      })

    return { standard, extras, sections }
  }

  if (qualifyingLotIds.length > 0) {
    const quotesResult = await supabase
      .from('lot_quotes')
      .select(`
        lot_id, is_estimated, status,
        lot_quote_items(
          quantity, unit_price_snapshot, item_name, unit,
          quote_template_items(
            unit_price, section_id, order_index,
            quote_template_sections(name, is_client_extra, order_index)
          )
        )
      `)
      .in('lot_id', qualifyingLotIds)

    if (quotesResult.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byLot = new Map<string, any[]>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const q of quotesResult.data as any[]) {
        const arr = byLot.get(q.lot_id) ?? []
        arr.push(q)
        byLot.set(q.lot_id, arr)
      }
      for (const [lotId, quotes] of byLot) {
        const best = [...quotes].sort((a, b) => bestQuoteScore(b) - bestQuoteScore(a))[0]
        amountByLot.set(lotId, buildSections(best.lot_quote_items ?? []))
      }
    }
  }

  // ── Build structured view data ────────────────────────────────────────────
  const sites: SiteData[] = activeSites
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((site: any): SiteData => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stages: StageData[] = ([...(site.stages ?? [])] as any[])
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((stage): StageData => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const siteShowClientExtras = (site as any).has_client_extras ?? true
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lots: LotRow[] = ((stage.lots ?? []) as any[])
            .filter((l) => l.build_complete || l.quant_done)
            .map((lot): LotRow => {
              const amounts          = amountByLot.get(lot.id) ?? { standard: 0, extras: 0, sections: [] }
              const showClientExtras = siteShowClientExtras && (lot.has_client_extras ?? true)
              return {
                id:                 lot.id,
                lotNumber:          lot.lot_number,
                buildComplete:      lot.build_complete ?? false,
                quantDone:          lot.quant_done     ?? false,
                invoiced:           lot.invoiced        ?? false,
                standardAmount:     amounts.standard,
                clientExtrasAmount: showClientExtras ? amounts.extras : 0,
                sections:           amounts.sections,
                showClientExtras,
              }
            })
            .sort((a, b) =>
              a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true })
            )
          return { id: stage.id, name: stage.name, lots }
        })
        .filter((st) => st.lots.length > 0)
      return { id: site.id, name: site.name, clientContact: site.client_contact ?? null, stages }
    })
    .filter((s) => s.stages.length > 0)

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        <h1 className="text-xl font-semibold text-stone-900">Invoices</h1>
        <InvoicesView sites={sites} />
      </div>
    </div>
  )
}
