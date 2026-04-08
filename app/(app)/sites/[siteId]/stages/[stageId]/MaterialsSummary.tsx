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
        id, name, order_index, admin_only,
        quote_template_items (
          id, name, unit, unit_price, plant_category,
          order_index, is_active, is_auto_calculated, auto_calc_formula
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

  type RawItem = {
    id: string; name: string; unit: string; unit_price: number | null
    plant_category: string | null; order_index: number
    is_active: boolean; is_auto_calculated: boolean; auto_calc_formula: string | null
  }

  const sections = (sectionsData ?? []).map((s) => ({
    id:          s.id,
    name:        s.name,
    order_index: s.order_index,
    admin_only:  (s as { admin_only?: boolean }).admin_only ?? false,
    items: [...((s.quote_template_items ?? []) as RawItem[])]
      .sort((a, b) => a.order_index - b.order_index),
  }))

  // Build item lookup
  const itemById = new Map<string, RawItem>()
  for (const s of sections) {
    for (const i of s.items) itemById.set(i.id, i)
  }

  const lots = lotsData ?? []
  const totalLots = lots.length

  type LotQuote = {
    status: string; is_estimated: boolean
    lot_quote_items: { template_item_id: string; quantity: number | null; unit_price_snapshot: number | null }[]
  }

  function bestQuote(lotQuotes: LotQuote[]) {
    if (!lotQuotes || lotQuotes.length === 0) return null
    const priority = (q: LotQuote) => {
      const s = q.status === 'approved' ? 3 : q.status === 'submitted' ? 2 : 1
      return s * 10 + (q.is_estimated ? 0 : 1)
    }
    return [...lotQuotes].sort((a, b) => priority(b) - priority(a))[0]
  }

  // Aggregate: template_item_id → { total_qty, total_cost, lot_count }
  const agg = new Map<string, { total_qty: number; total_cost: number; lot_count: number }>()
  let quotedLots = 0

  for (const lot of lots) {
    const quote = bestQuote(lot.lot_quotes as LotQuote[])
    if (!quote) continue
    quotedLots++
    for (const qi of quote.lot_quote_items) {
      if (qi.quantity === null || qi.template_item_id === null) continue
      const existing = agg.get(qi.template_item_id) ?? { total_qty: 0, total_cost: 0, lot_count: 0 }
      const price    = qi.unit_price_snapshot ?? null
      agg.set(qi.template_item_id, {
        total_qty:  existing.total_qty + qi.quantity,
        total_cost: existing.total_cost + (price != null ? qi.quantity * price : 0),
        lot_count:  existing.lot_count + 1,
      })
    }
  }

  const grandTotal = isAdmin
    ? [...agg.values()].reduce((s, v) => s + v.total_cost, 0)
    : 0

  // Filter sections with data (skip admin_only sections in summary unless admin)
  const sectionsWithData = sections
    .filter((s) => isAdmin || !s.admin_only)
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (!i.is_active) return false
        // Skip variant secondary items (auto_calc_formula = variant_group:X but not first in group)
        // We still want to show them aggregated, but check agg
        return agg.has(i.id)
      }),
    }))
    .filter((s) => s.items.length > 0)

  // ── Derived totals ─────────────────────────────────────────────────────────
  // Sum all plant quantities (items with plant_category set)
  let totalFrontPlants = 0
  let totalRearPlants  = 0
  for (const [id, data] of agg) {
    const item = itemById.get(id)
    if (!item) continue
    if (item.plant_category === 'front') totalFrontPlants += data.total_qty
    if (item.plant_category === 'rear')  totalRearPlants  += data.total_qty
  }
  const totalPlants = totalFrontPlants + totalRearPlants

  // Turf: m² items with "turf" in name
  let totalTurf = 0
  for (const [id, data] of agg) {
    const item = itemById.get(id)
    if (!item) continue
    if (item.unit === 'm²' && /turf/i.test(item.name)) totalTurf += data.total_qty
  }

  const hasDerivedData = totalPlants > 0 || totalTurf > 0

  if (sectionsWithData.length === 0 && !hasDerivedData) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center">
        <p className="text-sm text-stone-500">No quantities submitted yet.</p>
        <p className="text-xs text-stone-400 mt-1">
          Quantities will appear here once leading hands submit lot takeoffs.
        </p>
      </div>
    )
  }

  function fmtQty(qty: number, unit: string) {
    if (unit === 'm²' || unit === 'm³' || unit === 'Lm') {
      return qty % 1 === 0 ? String(qty) : qty.toFixed(1)
    }
    return String(Math.round(qty))
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
          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-700">{section.name}</h3>
            {section.admin_only && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Admin only</span>
            )}
          </div>

          <div className={`grid px-4 py-2 border-b border-stone-100 text-xs font-medium text-stone-400 ${isAdmin ? 'grid-cols-[1fr_80px_60px_90px]' : 'grid-cols-[1fr_80px_60px]'}`}>
            <span>Item</span>
            <span className="text-right">Total qty</span>
            <span className="text-right">Lots</span>
            {isAdmin && <span className="text-right">Total cost</span>}
          </div>

          {section.items.map((item) => {
            const data = agg.get(item.id)
            if (!data) return null
            return (
              <div
                key={item.id}
                className={`grid px-4 py-3 border-b border-stone-100 items-center text-sm ${isAdmin ? 'grid-cols-[1fr_80px_60px_90px]' : 'grid-cols-[1fr_80px_60px]'}`}
              >
                <span className="text-stone-800 truncate pr-2">{item.name}</span>
                <span className="text-right font-medium text-stone-900 tabular-nums">
                  {fmtQty(data.total_qty, item.unit)}{' '}
                  <span className="text-xs font-normal text-stone-400">{item.unit !== 'ITEM' ? item.unit : ''}</span>
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

      {/* ── Derived totals ────────────────────────────────────────────────────── */}
      {hasDerivedData && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
            <h3 className="text-sm font-semibold text-stone-700">Derived totals</h3>
          </div>

          {totalPlants > 0 && (
            <>
              <DerivedRow label="Front plants" value={String(Math.round(totalFrontPlants))} unit="No." />
              <DerivedRow label="Rear plants"  value={String(Math.round(totalRearPlants))}  unit="No." />
              <DerivedRow label="Total plants" value={String(Math.round(totalPlants))}      unit="No." bold />
              <DerivedRow label="Drippers required"  value={String(Math.round(totalPlants))}                          unit="No." />
              <DerivedRow label="Jabs required"      value={String(Math.round(totalPlants))}                          unit="No." />
              <DerivedRow label="Dripper tube"       value={(Math.round(totalPlants * 0.5 * 10) / 10).toFixed(1)}    unit="Lm"  />
            </>
          )}

          {totalTurf > 0 && (
            <DerivedRow label="Total turf" value={totalTurf % 1 === 0 ? String(totalTurf) : totalTurf.toFixed(1)} unit="m²" />
          )}
        </div>
      )}

      {/* Lots with no quote */}
      {(() => {
        const unquoted = lots.filter((l) => !bestQuote(l.lot_quotes as LotQuote[]))
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

function DerivedRow({ label, value, unit, bold }: {
  label: string; value: string; unit: string; bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
      <span className={`text-sm ${bold ? 'font-semibold text-stone-800' : 'text-stone-600'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold text-stone-900' : 'font-medium text-stone-700'}`}>
        {value} <span className="text-xs font-normal text-stone-400">{unit}</span>
      </span>
    </div>
  )
}
