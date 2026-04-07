import { createClient } from '@/lib/supabase/server'

interface Props {
  stageId: string
  siteId:  string
  isAdmin: boolean
}

export default async function MaterialsSummary({ stageId, siteId, isAdmin }: Props) {
  const supabase = await createClient()

  const [{ data: sectionsData }, { data: lotsData }] = await Promise.all([
    supabase
      .from('quote_template_sections')
      .select(`
        id, name, order_index,
        quote_template_items (
          id, name, unit, unit_price, order_index, is_active, is_auto_calculated
        )
      `)
      .eq('is_active', true)
      .order('order_index', { ascending: true }),

    supabase
      .from('lots')
      .select(`
        id, lot_number,
        lot_quotes (
          id, status, is_estimated,
          lot_quote_items ( template_item_id, quantity, unit_price_snapshot )
        )
      `)
      .eq('stage_id', stageId)
      .order('lot_number', { ascending: true }),
  ])

  const sections = (sectionsData ?? []).map((s) => ({
    ...s,
    quote_template_items: [...((s.quote_template_items ?? []) as {
      id: string; name: string; unit: string; unit_price: number | null;
      order_index: number; is_active: boolean; is_auto_calculated: boolean
    }[])].sort((a, b) => a.order_index - b.order_index),
  }))

  const lots = lotsData ?? []
  const totalLots = lots.length

  // For each lot, pick the most relevant quote:
  // prefer submitted/approved over draft; prefer final (is_estimated=false) over estimate
  function bestQuote(lotQuotes: { status: string; is_estimated: boolean; lot_quote_items: { template_item_id: string; quantity: number | null; unit_price_snapshot: number | null }[] }[]) {
    if (!lotQuotes || lotQuotes.length === 0) return null
    const priority = (q: typeof lotQuotes[0]) => {
      const statusScore = q.status === 'approved' ? 3 : q.status === 'submitted' ? 2 : 1
      const typeScore   = q.is_estimated ? 0 : 1
      return statusScore * 10 + typeScore
    }
    return [...lotQuotes].sort((a, b) => priority(b) - priority(a))[0]
  }

  // Aggregate: template_item_id -> { total_qty, total_cost, lot_count }
  const agg = new Map<string, { total_qty: number; total_cost: number; lot_count: number }>()
  let quotedLots = 0

  for (const lot of lots) {
    const quote = bestQuote(lot.lot_quotes as Parameters<typeof bestQuote>[0])
    if (!quote) continue
    quotedLots++
    for (const qi of quote.lot_quote_items) {
      if (qi.quantity === null || qi.template_item_id === null) continue
      const existing = agg.get(qi.template_item_id) ?? { total_qty: 0, total_cost: 0, lot_count: 0 }
      const price = qi.unit_price_snapshot ?? null
      agg.set(qi.template_item_id, {
        total_qty:  existing.total_qty + qi.quantity,
        total_cost: existing.total_cost + (price != null ? qi.quantity * price : 0),
        lot_count:  existing.lot_count + 1,
      })
    }
  }

  // Grand total cost (admin only)
  const grandTotal = isAdmin
    ? [...agg.values()].reduce((s, v) => s + v.total_cost, 0)
    : 0

  // Filter to sections/items that have any quantities
  const sectionsWithData = sections
    .map((s) => ({
      ...s,
      quote_template_items: s.quote_template_items.filter((i) => i.is_active && agg.has(i.id)),
    }))
    .filter((s) => s.quote_template_items.length > 0)

  if (sectionsWithData.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center">
        <p className="text-sm text-stone-500">No quantities submitted yet.</p>
        <p className="text-xs text-stone-400 mt-1">
          Quantities will appear here once leading hands submit lot takeoffs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-stone-500">
          <span className="font-semibold text-stone-800">{quotedLots}</span> of {totalLots} lots quoted
        </span>
        {isAdmin && grandTotal > 0 && (
          <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
            Total: ${grandTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {/* Sections */}
      {sectionsWithData.map((section) => (
        <div key={section.id} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
            <h3 className="text-sm font-semibold text-stone-700">{section.name}</h3>
          </div>

          {/* Column headers */}
          <div className={`grid px-4 py-2 border-b border-stone-100 text-xs font-medium text-stone-400 ${isAdmin ? 'grid-cols-[1fr_80px_60px_90px]' : 'grid-cols-[1fr_80px_60px]'}`}>
            <span>Item</span>
            <span className="text-right">Total qty</span>
            <span className="text-right">Lots</span>
            {isAdmin && <span className="text-right">Total cost</span>}
          </div>

          {section.quote_template_items.map((item) => {
            const data = agg.get(item.id)
            if (!data) return null
            const qty = data.total_qty
            const displayQty = item.unit === 'Lin M' || item.unit === 'm²' || item.unit === 'm³'
              ? qty % 1 === 0 ? String(qty) : qty.toFixed(1)
              : String(Math.round(qty))

            return (
              <div
                key={item.id}
                className={`grid px-4 py-3 border-b border-stone-100 items-center text-sm ${isAdmin ? 'grid-cols-[1fr_80px_60px_90px]' : 'grid-cols-[1fr_80px_60px]'}`}
              >
                <span className="text-stone-800 truncate pr-2">{item.name}</span>
                <span className="text-right font-medium text-stone-900 tabular-nums">
                  {displayQty} <span className="text-xs font-normal text-stone-400">{item.unit}</span>
                </span>
                <span className="text-right text-stone-500 tabular-nums">
                  {data.lot_count}/{totalLots}
                </span>
                {isAdmin && (
                  <span className="text-right font-medium text-stone-700 tabular-nums">
                    {data.total_cost > 0
                      ? `$${data.total_cost.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : <span className="text-stone-300 font-normal">—</span>
                    }
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* Lots with no quote */}
      {(() => {
        const unquoted = lots.filter((l) => !bestQuote(l.lot_quotes as Parameters<typeof bestQuote>[0]))
        if (unquoted.length === 0) return null
        return (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-stone-500 mb-2">No quantities yet</p>
            <div className="flex flex-wrap gap-1.5">
              {unquoted.map((l) => (
                <a
                  key={l.id}
                  href={`/sites/${siteId}/stages/${stageId}/lots/${l.id}`}
                  className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-200"
                >
                  Lot {l.lot_number}
                </a>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
