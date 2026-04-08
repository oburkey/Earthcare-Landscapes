import { createClient } from '@/lib/supabase/server'

interface Props {
  stageId: string
  siteId:  string
}

export default async function MaterialsSummary({ stageId, siteId }: Props) {
  const supabase = await createClient()

  const [{ data: itemsData }, { data: lotsData }] = await Promise.all([
    supabase
      .from('quote_template_items')
      .select('id, name, unit, plant_category, auto_calc_formula, is_active')
      .eq('is_active', true),

    supabase
      .from('lots')
      .select(`
        id, lot_number,
        lot_quotes (
          id, status, is_estimated,
          lot_quote_items ( template_item_id, quantity )
        )
      `)
      .eq('stage_id', stageId)
      .order('lot_number', { ascending: true }),
  ])

  type RawItem = {
    id: string
    name: string
    unit: string
    plant_category: string | null
    auto_calc_formula: string | null
    is_active: boolean
  }

  const items = (itemsData ?? []) as RawItem[]
  const itemById = new Map<string, RawItem>()
  for (const i of items) itemById.set(i.id, i)

  const lots = lotsData ?? []
  const totalLots = lots.length

  type LotQuote = {
    status: string
    is_estimated: boolean
    lot_quote_items: { template_item_id: string; quantity: number | null }[]
  }

  function bestQuote(quotes: LotQuote[]) {
    if (!quotes || quotes.length === 0) return null
    const score = (q: LotQuote) =>
      (q.status === 'approved' ? 3 : q.status === 'submitted' ? 2 : 1) * 10 +
      (q.is_estimated ? 0 : 1)
    return [...quotes].sort((a, b) => score(b) - score(a))[0]
  }

  // Aggregate: template_item_id → total quantity across all lots
  const agg = new Map<string, number>()
  let quotedLots = 0

  for (const lot of lots) {
    const quote = bestQuote(lot.lot_quotes as LotQuote[])
    if (!quote) continue
    quotedLots++
    for (const qi of quote.lot_quote_items) {
      if (qi.quantity === null || qi.quantity === 0 || !qi.template_item_id) continue
      agg.set(qi.template_item_id, (agg.get(qi.template_item_id) ?? 0) + qi.quantity)
    }
  }

  // ── Classify aggregated items ─────────────────────────────────────────────

  // Helper: sum qty for items matching a predicate
  function sumWhere(pred: (item: RawItem) => boolean): number {
    let total = 0
    for (const [id, qty] of agg) {
      const item = itemById.get(id)
      if (item && pred(item)) total += qty
    }
    return total
  }

  // PLANTS & TREES
  const smallPlants   = sumWhere((i) => !!i.plant_category && /130mm|200mm|300mm|5L/i.test(i.name))
  const trees90L      = sumWhere((i) => !!i.plant_category && /90L/i.test(i.name))
  const trees45L      = sumWhere((i) => !!i.plant_category && /45L/i.test(i.name))
  const smallTrees    = sumWhere((i) => /small\s+tree/i.test(i.name))
  const fruitTrees    = sumWhere((i) => /fruit\s+tree/i.test(i.name))

  // HARDSCAPE
  const steppers      = sumWhere((i) => /stepper/i.test(i.name))
  const edging        = sumWhere((i) => /edging/i.test(i.name) && i.unit === 'Lm')
  const turf          = sumWhere((i) => /turf/i.test(i.name) && i.unit === 'm²')
  const boulders      = sumWhere((i) => /boulder/i.test(i.name))

  // MULCH
  const limestoneMulch = sumWhere((i) => /limestone/i.test(i.name) && i.unit === 'm²')
  const lateriteMulch  = sumWhere((i) => /laterite/i.test(i.name) && i.unit === 'm²')
  const blackMulch     = sumWhere((i) => /black/i.test(i.name) && i.unit === 'm²')
  const whiteMulch     = sumWhere((i) => /white/i.test(i.name) && i.unit === 'm²')

  // IRRIGATION — derived from plant count (all items with plant_category)
  const totalPlants = sumWhere((i) => !!i.plant_category)
  const dripperTube = Math.round(totalPlants * 0.5 * 10) / 10

  const hasPlants     = smallPlants > 0 || trees90L > 0 || trees45L > 0 || smallTrees > 0 || fruitTrees > 0
  const hasHardscape  = steppers > 0 || edging > 0 || turf > 0 || boulders > 0
  const hasMulch      = limestoneMulch > 0 || lateriteMulch > 0 || blackMulch > 0 || whiteMulch > 0
  const hasIrrigation = totalPlants > 0

  if (quotedLots === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center">
        <p className="text-sm text-stone-500">No quantities submitted yet.</p>
        <p className="text-xs text-stone-400 mt-1">
          Quantities will appear once leading hands submit lot takeoffs.
        </p>
      </div>
    )
  }

  function fmtNo(n: number)  { return String(Math.round(n)) }
  function fmtM2(n: number)  { return n % 1 === 0 ? String(n) : n.toFixed(1) }
  function fmtLm(n: number)  { return n % 1 === 0 ? String(n) : n.toFixed(1) }
  function fmtTon(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(2) }

  const unquotedLots = lots.filter((l) => !bestQuote(l.lot_quotes as LotQuote[]))

  return (
    <div className="space-y-3">

      {/* Header */}
      <p className="text-sm text-stone-500">
        <span className="font-semibold text-stone-800">{quotedLots}</span> of {totalLots} lots quoted
      </p>

      {/* PLANTS & TREES */}
      {hasPlants && (
        <Section title="Plants & Trees">
          {smallPlants > 0  && <Row label="Plants (130/200/300mm)" value={fmtNo(smallPlants)}  unit="No." />}
          {trees90L > 0     && <Row label="Feature trees 90L"      value={fmtNo(trees90L)}     unit="No." />}
          {trees45L > 0     && <Row label="Feature trees 45L"      value={fmtNo(trees45L)}     unit="No." />}
          {smallTrees > 0   && <Row label="Small trees"            value={fmtNo(smallTrees)}   unit="No." />}
          {fruitTrees > 0   && <Row label="Fruit trees"            value={fmtNo(fruitTrees)}   unit="No." />}
        </Section>
      )}

      {/* HARDSCAPE */}
      {hasHardscape && (
        <Section title="Hardscape">
          {steppers > 0  && <Row label="Steppers"       value={fmtNo(steppers)}  unit="No."   />}
          {edging > 0    && <Row label="Steel edging"   value={fmtLm(edging)}    unit="Lm"    />}
          {turf > 0      && <Row label="Artificial turf" value={fmtM2(turf)}     unit="m²"    />}
          {boulders > 0  && <Row label="Boulders"       value={fmtTon(boulders)} unit="tonne" />}
        </Section>
      )}

      {/* MULCH */}
      {hasMulch && (
        <Section title="Mulch">
          {limestoneMulch > 0 && <Row label="Limestone 32mm"  value={fmtM2(limestoneMulch)} unit="m²" />}
          {lateriteMulch > 0  && <Row label="Laterite gravel" value={fmtM2(lateriteMulch)}  unit="m²" />}
          {blackMulch > 0     && <Row label="Black mulch"     value={fmtM2(blackMulch)}      unit="m²" />}
          {whiteMulch > 0     && <Row label="White mulch"     value={fmtM2(whiteMulch)}      unit="m²" />}
        </Section>
      )}

      {/* IRRIGATION (derived) */}
      {hasIrrigation && (
        <Section title="Irrigation">
          <Row label="Drippers required"     value={fmtNo(totalPlants)}          unit="No." />
          <Row label="Jabs required"         value={fmtNo(totalPlants)}          unit="No." />
          <Row label="Dripper tube estimate" value={fmtLm(dripperTube)}          unit="Lm"  derived />
        </Section>
      )}

      {/* Unquoted lots */}
      {unquotedLots.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-stone-500 mb-2">Not yet quoted</p>
          <div className="flex flex-wrap gap-1.5">
            {unquotedLots.map((l) => (
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
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, unit, derived }: {
  label: string
  value: string
  unit: string
  derived?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 last:border-0">
      <span className={`text-sm ${derived ? 'text-stone-500' : 'text-stone-800'}`}>
        {label}
        {derived && <span className="ml-1 text-xs text-stone-400">(estimated)</span>}
      </span>
      <span className="text-sm font-semibold text-stone-900 tabular-nums">
        {value}
        <span className="ml-1 text-xs font-normal text-stone-400">{unit}</span>
      </span>
    </div>
  )
}
