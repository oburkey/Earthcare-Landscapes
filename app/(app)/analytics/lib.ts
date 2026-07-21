// Data shaping & calculations for the Analytics page.
//
// Covers Providence-style per-lot pricing only (lot_quotes / lot_quote_items).
// Sites/lots without any lot_quotes data are excluded from revenue figures
// (not shown as $0) and counted via `excludedLotsCount`.
//
// Materials item-name mapping matches the live template seed (supabase/seed_phase2.sql),
// consistent with app/(app)/materials/lib.ts:
//   Turf            = 'Artificial Turf' (front "Hardscape Works — Front" + rear "Rear & Side Lot")
//   Garden bed front m² = 'Mulch Limestone 32mm' + 'Black Mulch' + 'White Mulch' in "Softscape Works — Front"
//   Garden bed rear m²  = 'Limestone Mulch' + 'Black Mulch' in "Rear & Side Lot"
//   Edging          = 'Steel Edging' (front) + 'Edging' (rear, "Rear & Side Lot") — Client Extras excluded
//   Plants front/rear = quote_template_items.plant_category 'front' / 'rear'

export type RangeKey = '3m' | '6m' | '12m' | 'all'

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
  { key: '12m', label: '12 months' },
  { key: 'all', label: 'All time' },
]

const FRONT_BED_ITEMS = ['Mulch Limestone 32mm', 'Black Mulch', 'White Mulch']
const FRONT_BED_SECTION = 'Softscape Works — Front'
const REAR_BED_ITEMS = ['Limestone Mulch', 'Black Mulch']
const REAR_BED_SECTION = 'Rear & Side Lot'
const TURF_ITEM = 'Artificial Turf'
const FRONT_EDGING_ITEM = 'Steel Edging'
const FRONT_EDGING_SECTION = 'Hardscape Works — Front'
const REAR_EDGING_ITEM = 'Edging'
const REAR_EDGING_SECTION = 'Rear & Side Lot'

const DEFAULT_FRONT_RATIO = 2.0
const DEFAULT_REAR_RATIO = 1.75

// ── Raw input shapes (from Supabase queries in page.tsx) ─────────────────────

export type SiteRow = { id: string; name: string }
export type StageRow = {
  id: string
  name: string
  site_id: string
  order: number
  is_contract_pricing: boolean | null
  default_contract_price: number | null
}
export type SubcontractorCostRow = {
  lot_id: string
  trade: string
  trade_label: string | null
  invoice_amount: number
}
export type LotRow = {
  id: string
  lot_number: string
  stage_id: string
  due_date: string | null
  build_complete: boolean
  invoiced: boolean
  contract_price: number | null
}
export type CompletedLotRow = { id: string; build_completed_at: string }
export type RatioRow = { site_id: string | null; front_ratio: number; rear_ratio: number }

type SectionRef = { name: string; is_client_extra: boolean | null }
type TemplateItemRef = {
  unit_price: number | null
  plant_category: string | null
  quote_template_sections: SectionRef | SectionRef[] | null
}
export type QuoteItemRow = {
  item_name: string
  quantity: number | null
  unit_price_snapshot: number | null
  quote_template_items: TemplateItemRef | TemplateItemRef[] | null
}
export type QuoteRow = {
  lot_id: string
  is_estimated: boolean
  status: string
  lot_quote_items: QuoteItemRow[] | null
}

// ── Output shapes ─────────────────────────────────────────────────────────────

export type CategoryQuantities = {
  turf: number
  gardenBedFront: number
  gardenBedRear: number
  edging: number
  plantsFront: number
  plantsRear: number
}

type CategoryKey = keyof CategoryQuantities

export type VarianceStat = { avgPct: number | null; n: number }

export type MaterialsVariance = Record<CategoryKey, VarianceStat>

export type MonthPoint = { key: string; label: string }

export type RevenueMonthPoint = MonthPoint & { invoiced: number; pipeline: number }
export type CompletionMonthPoint = MonthPoint & { count: number }
export type VarianceTrendPoint = MonthPoint & Record<CategoryKey, number | null>

// NLV = contract-priced work (as opposed to Providence-style quoted lots).
// contractValue only sums lots that actually resolved to a price (own price
// or stage default); subcontractorCost sums subcontractor_costs regardless.
export type NlvSummary = {
  contractValue: number
  subcontractorCost: number
  margin: number
  marginPct: number | null
}

export type AggregateSummary = {
  lotCount: number
  completedCount: number
  completionPct: number
  revenue: { invoiced: number; pipeline: number; total: number }
  avgLotValue: number
  materialsVariance: MaterialsVariance
  nlv: NlvSummary
}

export type LotVarianceCategory = { key: CategoryKey; label: string; pct: number }
export type SubcontractorCostLine = { trade: string; label: string; amount: number }

export type LotDrillDownRow = {
  id: string
  lotNumber: string
  dueDate: string | null
  buildComplete: boolean
  invoiced: boolean
  finalTotal: number | null
  estimateOnlyTotal: number | null
  varianceCategories: LotVarianceCategory[] | null
  contractPrice: number | null
  subcontractorCost: number
  subcontractorBreakdown: SubcontractorCostLine[]
  margin: number | null
  marginPct: number | null
}

export type StageAnalytics = {
  id: string
  name: string
  isContractPricing: boolean
  summary: AggregateSummary
  lots: LotDrillDownRow[]
}

export type SiteAnalytics = {
  id: string
  name: string
  summary: AggregateSummary
  stages: StageAnalytics[]
}

export type MaterialsSection = {
  variance: MaterialsVariance
  trend: VarianceTrendPoint[]
  plantRatios: {
    configuredFront: number
    configuredRear: number
    actualFront: number | null
    actualRear: number | null
  }
}

// Lightweight site/stage list for the materials-accuracy filter sidebar —
// independent of whether a site/stage currently has any lots.
export type MaterialsSiteOption = { id: string; name: string; stages: { id: string; name: string }[] }

export type AnalyticsData = {
  rangeLabel: string
  revenue: {
    invoiced: { total: number; count: number; eligible: number }
    pipeline: { total: number; count: number; eligible: number }
    avgComparison: { avgInvoiced: number; avgEstimated: number; pctDiff: number; n: number } | null
    excludedLotsCount: number
    monthly: RevenueMonthPoint[]
    completedPerMonth: CompletionMonthPoint[]
  }
  materials: MaterialsSection
  materialsBySite: Record<string, MaterialsSection>
  materialsByStage: Record<string, MaterialsSection>
  materialsSiteIndex: MaterialsSiteOption[]
  sites: SiteAnalytics[]
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  turf: 'Turf',
  gardenBedFront: 'Garden bed (front)',
  gardenBedRear: 'Garden bed (rear)',
  edging: 'Edging',
  plantsFront: 'Plants (front)',
  plantsRear: 'Plants (rear)',
}

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[]

// ── Date range helpers ─────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Backward-looking window ending this month — for build_completed_at (always in the past).
export function getCompletionRange(range: RangeKey, now: Date = new Date()): { startDate: string | null; endDate: string | null } {
  if (range === 'all') return { startDate: null, endDate: null }
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { startDate: isoDate(start), endDate: isoDate(end) }
}

// Forward-looking window starting this month — for due_date (mostly upcoming pipeline work).
export function getPipelineRange(range: RangeKey, now: Date = new Date()): { startDate: string | null; endDate: string | null } {
  if (range === 'all') return { startDate: null, endDate: null }
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + months, 1)
  return { startDate: isoDate(start), endDate: isoDate(end) }
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

function generateMonthRange(startDate: string, endDateExclusive: string): MonthPoint[] {
  const result: MonthPoint[] = []
  let [y, m] = startDate.slice(0, 7).split('-').map(Number)
  const [ey, em] = endDateExclusive.slice(0, 7).split('-').map(Number)
  while (y < ey || (y === ey && m < em)) {
    const key = `${y}-${pad(m)}`
    result.push({ key: key, label: monthLabel(key) })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

// For "all-time" range, derive the month list from the actual data present.
function resolveMonthRange(startDate: string | null, endDate: string | null, dates: (string | null)[]): MonthPoint[] {
  if (startDate && endDate) return generateMonthRange(startDate, endDate)

  const keys = dates.filter((d): d is string => !!d).map(monthKey)
  if (keys.length === 0) return []
  const sorted = [...new Set(keys)].sort()
  const minKey = sorted[0]
  const maxKey = sorted[sorted.length - 1]
  const [ey, em] = maxKey.split('-').map(Number)
  let ny = ey, nm = em + 1
  if (nm > 12) { nm = 1; ny++ }
  return generateMonthRange(`${minKey}-01`, `${ny}-${pad(nm)}-01`)
}

// ── Supabase relation normalization ─────────────────────────────────────────────

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

// ── Quote calculations ─────────────────────────────────────────────────────────

function quoteTotal(items: QuoteItemRow[] | null | undefined): number {
  if (!items) return 0
  return items.reduce((total, item) => {
    const qty = Number(item.quantity ?? 0)
    const tpl = one(item.quote_template_items)
    const price = Number(item.unit_price_snapshot ?? tpl?.unit_price ?? 0)
    return total + qty * price
  }, 0)
}

function bestQuoteScore(q: QuoteRow): number {
  const statusScore = q.status === 'approved' ? 3 : q.status === 'submitted' ? 2 : 1
  const typeScore = q.is_estimated ? 0 : 1 // final preferred over estimated
  return statusScore * 10 + typeScore
}

function computeCategoryQuantities(items: QuoteItemRow[] | null | undefined): CategoryQuantities {
  const cats: CategoryQuantities = { turf: 0, gardenBedFront: 0, gardenBedRear: 0, edging: 0, plantsFront: 0, plantsRear: 0 }
  if (!items) return cats

  for (const item of items) {
    const qty = Number(item.quantity ?? 0)
    const tpl = one(item.quote_template_items)
    const section = one(tpl?.quote_template_sections)
    const sectionName = section?.name ?? ''
    const name = item.item_name

    if (name === TURF_ITEM) cats.turf += qty
    if (name === FRONT_EDGING_ITEM && sectionName === FRONT_EDGING_SECTION) cats.edging += qty
    if (name === REAR_EDGING_ITEM && sectionName === REAR_EDGING_SECTION) cats.edging += qty
    if (FRONT_BED_ITEMS.includes(name) && sectionName === FRONT_BED_SECTION) cats.gardenBedFront += qty
    if (REAR_BED_ITEMS.includes(name) && sectionName === REAR_BED_SECTION) cats.gardenBedRear += qty
    if (tpl?.plant_category === 'front') cats.plantsFront += qty
    if (tpl?.plant_category === 'rear') cats.plantsRear += qty
  }

  return cats
}

type LotCalc = {
  id: string
  lotNumber: string
  dueDate: string | null
  stageId: string
  buildComplete: boolean
  invoiced: boolean
  finalTotal: number | null
  estimateTotal: number | null
  bestTotal: number | null
  hasQuoteData: boolean
  estimateCats: CategoryQuantities | null
  finalCats: CategoryQuantities | null
  contractPrice: number | null
  subcontractorCost: number
  subcontractorBreakdown: SubcontractorCostLine[]
}

// stageDefaultPriceById lets a lot fall back to its stage's default_contract_price
// when it has no price of its own set — lot price always wins when present.
// subcontractorByLot is only needed for the NLV drill-down, so it's optional.
function buildLotCalcs(
  lots: LotRow[],
  quotes: QuoteRow[],
  stageDefaultPriceById: Map<string, number | null>,
  subcontractorByLot?: Map<string, SubcontractorCostLine[]>
): LotCalc[] {
  const byLot = new Map<string, QuoteRow[]>()
  for (const q of quotes) {
    const arr = byLot.get(q.lot_id) ?? []
    arr.push(q)
    byLot.set(q.lot_id, arr)
  }

  return lots.map((lot) => {
    const quotesForLot = byLot.get(lot.id) ?? []
    const finalQuote = quotesForLot.find((q) => !q.is_estimated) ?? null
    const estimateQuote = quotesForLot.find((q) => q.is_estimated) ?? null
    const best = quotesForLot.length > 0
      ? [...quotesForLot].sort((a, b) => bestQuoteScore(b) - bestQuoteScore(a))[0]
      : null

    const ownPrice = lot.contract_price != null ? Number(lot.contract_price) : null
    const cp = ownPrice ?? stageDefaultPriceById.get(lot.stage_id) ?? null
    const hasContractPrice = cp != null

    const subBreakdown = subcontractorByLot?.get(lot.id) ?? []
    const subcontractorCost = sum(subBreakdown.map((s) => s.amount))

    return {
      id: lot.id,
      lotNumber: lot.lot_number,
      dueDate: lot.due_date,
      stageId: lot.stage_id,
      buildComplete: lot.build_complete,
      invoiced: lot.invoiced,
      finalTotal: hasContractPrice ? cp : (finalQuote ? quoteTotal(finalQuote.lot_quote_items) : null),
      estimateTotal: hasContractPrice ? null : (estimateQuote ? quoteTotal(estimateQuote.lot_quote_items) : null),
      bestTotal: hasContractPrice ? cp : (best ? quoteTotal(best.lot_quote_items) : null),
      hasQuoteData: hasContractPrice || quotesForLot.length > 0,
      estimateCats: hasContractPrice ? null : (estimateQuote ? computeCategoryQuantities(estimateQuote.lot_quote_items) : null),
      finalCats: hasContractPrice ? null : (finalQuote ? computeCategoryQuantities(finalQuote.lot_quote_items) : null),
      contractPrice: cp,
      subcontractorCost,
      subcontractorBreakdown: subBreakdown,
    }
  })
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0)
}

// ── Materials variance ───────────────────────────────────────────────────────

function computeVariance(lots: LotCalc[]): MaterialsVariance {
  const result = {} as MaterialsVariance
  for (const key of CATEGORY_KEYS) {
    const diffs: number[] = []
    for (const lot of lots) {
      if (!lot.estimateCats || !lot.finalCats) continue
      const est = lot.estimateCats[key]
      const fin = lot.finalCats[key]
      if (est > 0) diffs.push(((fin - est) / est) * 100)
    }
    result[key] = { avgPct: diffs.length > 0 ? sum(diffs) / diffs.length : null, n: diffs.length }
  }
  return result
}

// Builds the variance / trend / plant-ratio bundle for a set of lots against
// a shared month axis (`months`) — used for the global "all sites" view and,
// filtered to a subset of lotCalcs, for the per-site and per-stage views in
// the materials-accuracy filter sidebar.
function buildMaterialsSection(
  lotCalcs: LotCalc[],
  months: MonthPoint[],
  configuredFront: number,
  configuredRear: number
): MaterialsSection {
  const variance = computeVariance(lotCalcs)

  const trend: VarianceTrendPoint[] = months.map(({ key, label }) => {
    const monthLots = lotCalcs.filter((l) => l.dueDate && monthKey(l.dueDate) === key)
    const v = computeVariance(monthLots)
    return {
      key,
      label,
      turf: v.turf.avgPct,
      gardenBedFront: v.gardenBedFront.avgPct,
      gardenBedRear: v.gardenBedRear.avgPct,
      edging: v.edging.avgPct,
      plantsFront: v.plantsFront.avgPct,
      plantsRear: v.plantsRear.avgPct,
    }
  })

  let totalFrontM2 = 0, totalFrontPlants = 0, totalRearM2 = 0, totalRearPlants = 0
  for (const lot of lotCalcs) {
    if (!lot.finalCats) continue
    totalFrontM2 += lot.finalCats.gardenBedFront
    totalFrontPlants += lot.finalCats.plantsFront
    totalRearM2 += lot.finalCats.gardenBedRear
    totalRearPlants += lot.finalCats.plantsRear
  }
  const actualFront = totalFrontM2 > 0 ? totalFrontPlants / totalFrontM2 : null
  const actualRear = totalRearM2 > 0 ? totalRearPlants / totalRearM2 : null

  return {
    variance,
    trend,
    plantRatios: { configuredFront, configuredRear, actualFront, actualRear },
  }
}

// Resolves plant ratio settings for a site, falling back to the global
// (site_id = null) setting, then to hardcoded defaults.
function resolveRatios(siteId: string | null, plantRatioSettings: RatioRow[]): { front: number; rear: number } {
  const globalSetting = plantRatioSettings.find((s) => s.site_id === null)
  const siteSetting = siteId ? plantRatioSettings.find((s) => s.site_id === siteId) : undefined
  return {
    front: siteSetting?.front_ratio ?? globalSetting?.front_ratio ?? DEFAULT_FRONT_RATIO,
    rear: siteSetting?.rear_ratio ?? globalSetting?.rear_ratio ?? DEFAULT_REAR_RATIO,
  }
}

// Per-category material variance for a single lot's expandable detail. Only
// meaningful when both an estimate and a final quote have quote-item data
// (contract-priced lots skip category tracking entirely — see buildLotCalcs).
function lotVarianceCategories(lot: LotCalc): LotVarianceCategory[] | null {
  if (!lot.estimateCats || !lot.finalCats) return null
  const parts: LotVarianceCategory[] = []
  for (const key of CATEGORY_KEYS) {
    const est = lot.estimateCats[key]
    const fin = lot.finalCats[key]
    if (est <= 0) continue
    const pct = ((fin - est) / est) * 100
    parts.push({ key, label: CATEGORY_LABELS[key], pct })
  }
  return parts.length > 0 ? parts : null
}

// ── Aggregate summaries (shared by drill-down & comparison) ────────────────────

function buildAggregateSummary(lots: LotCalc[]): AggregateSummary {
  const lotCount = lots.length
  const completedCount = lots.filter((l) => l.buildComplete).length
  const completionPct = lotCount > 0 ? (completedCount / lotCount) * 100 : 0

  let invoicedRevenue = 0
  let pipelineRevenue = 0
  let revenueLotCount = 0
  for (const lot of lots) {
    const invoicedTotal = lot.finalTotal ?? lot.bestTotal
    if (lot.invoiced && invoicedTotal !== null) {
      invoicedRevenue += invoicedTotal
      revenueLotCount++
    } else if (!lot.invoiced && lot.bestTotal !== null) {
      pipelineRevenue += lot.bestTotal
      revenueLotCount++
    }
  }
  const total = invoicedRevenue + pipelineRevenue
  const avgLotValue = revenueLotCount > 0 ? total / revenueLotCount : 0

  const contractValue = sum(lots.filter((l) => l.contractPrice != null).map((l) => l.contractPrice!))
  const subcontractorCost = sum(lots.map((l) => l.subcontractorCost))
  const margin = contractValue - subcontractorCost
  const marginPct = contractValue > 0 ? (margin / contractValue) * 100 : null

  return {
    lotCount,
    completedCount,
    completionPct,
    revenue: { invoiced: invoicedRevenue, pipeline: pipelineRevenue, total },
    avgLotValue,
    materialsVariance: computeVariance(lots),
    nlv: { contractValue, subcontractorCost, margin, marginPct },
  }
}

// ── Main pipeline ────────────────────────────────────────────────────────────

export function buildAnalyticsData(input: {
  rangeLabel: string
  pipelineStartDate: string | null
  pipelineEndDate: string | null
  completionStartDate: string | null
  completionEndDate: string | null
  sites: SiteRow[]
  stages: StageRow[]
  lots: LotRow[]
  completedLots: CompletedLotRow[]
  quotes: QuoteRow[]
  plantRatioSettings: RatioRow[]
  // All lots/quotes unfiltered by date — used only for the drill-down section
  allLots?: LotRow[]
  allQuotes?: QuoteRow[]
  // Unfiltered by date, keyed by lot_id — feeds NLV margin in the drill-down
  subcontractorCosts?: SubcontractorCostRow[]
}): AnalyticsData {
  const { rangeLabel, pipelineStartDate, pipelineEndDate, completionStartDate, completionEndDate, sites, stages, lots, completedLots, quotes, plantRatioSettings, allLots, allQuotes, subcontractorCosts } = input

  const stageDefaultPriceById = new Map(
    stages.map((s) => [s.id, s.default_contract_price != null ? Number(s.default_contract_price) : null] as const)
  )

  const lotCalcs = buildLotCalcs(lots, quotes, stageDefaultPriceById)
  const lotsWithQuotes = lotCalcs.filter((l) => l.hasQuoteData)
  const excludedLotsCount = lotCalcs.length - lotsWithQuotes.length

  // ── Section 1: revenue ────────────────────────────────────────────────────
  const invoicedLots = lotsWithQuotes.filter((l) => l.invoiced)
  const invoicedTotal = sum(
    invoicedLots
      .map((l) => l.finalTotal ?? l.bestTotal)
      .filter((v): v is number => v !== null)
  )

  const pipelineLots = lotsWithQuotes.filter((l) => !l.invoiced)
  const pipelineEligible = pipelineLots.filter((l) => l.bestTotal !== null)
  const pipelineTotal = sum(pipelineEligible.map((l) => l.bestTotal!))

  const compareLots = invoicedLots.filter(
    (l) => l.finalTotal !== null && l.estimateTotal !== null && l.estimateTotal > 0
  )
  let avgComparison: AnalyticsData['revenue']['avgComparison'] = null
  if (compareLots.length > 0) {
    const avgInvoiced = sum(compareLots.map((l) => l.finalTotal!)) / compareLots.length
    const avgEstimated = sum(compareLots.map((l) => l.estimateTotal!)) / compareLots.length
    avgComparison = {
      avgInvoiced,
      avgEstimated,
      pctDiff: ((avgInvoiced - avgEstimated) / avgEstimated) * 100,
      n: compareLots.length,
    }
  }

  const revenueMonths = resolveMonthRange(pipelineStartDate, pipelineEndDate, lotsWithQuotes.map((l) => l.dueDate))
  const monthly: RevenueMonthPoint[] = revenueMonths.map(({ key, label }) => {
    let invoiced = 0
    let pipeline = 0
    for (const lot of lotsWithQuotes) {
      if (!lot.dueDate || monthKey(lot.dueDate) !== key) continue
      const invoicedTotal = lot.finalTotal ?? lot.bestTotal
      if (lot.invoiced && invoicedTotal !== null) invoiced += invoicedTotal
      else if (!lot.invoiced && lot.bestTotal !== null) pipeline += lot.bestTotal
    }
    return { key, label, invoiced, pipeline }
  })

  const completionMonths = resolveMonthRange(completionStartDate, completionEndDate, completedLots.map((l) => l.build_completed_at))
  const completedPerMonth: CompletionMonthPoint[] = completionMonths.map(({ key, label }) => ({
    key,
    label,
    count: completedLots.filter((l) => monthKey(l.build_completed_at) === key).length,
  }))

  // ── Section 2: materials & quote accuracy ──────────────────────────────────
  const globalRatios = resolveRatios(null, plantRatioSettings)
  const materials = buildMaterialsSection(lotCalcs, revenueMonths, globalRatios.front, globalRatios.rear)

  // Per-site / per-stage breakdowns for the materials-accuracy filter sidebar —
  // built from the same date-filtered lotCalcs as the global view above, so
  // switching the filter doesn't change what date range is being looked at.
  const materialsBySite: Record<string, MaterialsSection> = {}
  const materialsByStage: Record<string, MaterialsSection> = {}
  const materialsSiteIndex: MaterialsSiteOption[] = sites.map((site) => {
    const siteStages = stages.filter((s) => s.site_id === site.id).sort((a, b) => a.order - b.order)
    const siteRatios = resolveRatios(site.id, plantRatioSettings)

    const siteLotCalcs = lotCalcs.filter((l) => siteStages.some((s) => s.id === l.stageId))
    materialsBySite[site.id] = buildMaterialsSection(siteLotCalcs, revenueMonths, siteRatios.front, siteRatios.rear)

    for (const stage of siteStages) {
      const stageLotCalcs = lotCalcs.filter((l) => l.stageId === stage.id)
      materialsByStage[stage.id] = buildMaterialsSection(stageLotCalcs, revenueMonths, siteRatios.front, siteRatios.rear)
    }

    return { id: site.id, name: site.name, stages: siteStages.map((s) => ({ id: s.id, name: s.name })) }
  })

  // ── Sections 3 & 4: site → stage → lot drill-down ───────────────────────────
  // Uses allLots/allQuotes when provided so the drill-down ignores the date range filter.
  const subcontractorByLot = new Map<string, SubcontractorCostLine[]>()
  for (const c of subcontractorCosts ?? []) {
    const arr = subcontractorByLot.get(c.lot_id) ?? []
    arr.push({ trade: c.trade, label: c.trade_label ?? c.trade, amount: Number(c.invoice_amount ?? 0) })
    subcontractorByLot.set(c.lot_id, arr)
  }
  const drillLotCalcs = allLots
    ? buildLotCalcs(allLots, allQuotes ?? quotes, stageDefaultPriceById, subcontractorByLot)
    : lotCalcs

  const lotsByStage = new Map<string, LotCalc[]>()
  for (const lot of drillLotCalcs) {
    const arr = lotsByStage.get(lot.stageId) ?? []
    arr.push(lot)
    lotsByStage.set(lot.stageId, arr)
  }

  const siteAnalytics: SiteAnalytics[] = sites
    .map((site) => {
      const siteStages = stages.filter((s) => s.site_id === site.id).sort((a, b) => a.order - b.order)

      const stageAnalytics: StageAnalytics[] = siteStages.map((stage) => {
        const stageLots = lotsByStage.get(stage.id) ?? []
        const summary = buildAggregateSummary(stageLots)
        const lotsRows: LotDrillDownRow[] = [...stageLots]
          .sort((a, b) => a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true }))
          .map((lot) => {
            const margin = lot.contractPrice != null ? lot.contractPrice - lot.subcontractorCost : null
            const marginPct = margin != null && lot.contractPrice! > 0 ? (margin / lot.contractPrice!) * 100 : null
            return {
              id: lot.id,
              lotNumber: lot.lotNumber,
              dueDate: lot.dueDate,
              buildComplete: lot.buildComplete,
              invoiced: lot.invoiced,
              finalTotal: lot.finalTotal,
              estimateOnlyTotal: lot.finalTotal === null ? lot.estimateTotal : null,
              varianceCategories: lotVarianceCategories(lot),
              contractPrice: lot.contractPrice,
              subcontractorCost: lot.subcontractorCost,
              subcontractorBreakdown: lot.subcontractorBreakdown,
              margin,
              marginPct,
            }
          })
        return {
          id: stage.id,
          name: stage.name,
          isContractPricing: stage.is_contract_pricing ?? false,
          summary,
          lots: lotsRows,
        }
      })

      const allSiteLots = siteStages.flatMap((stage) => lotsByStage.get(stage.id) ?? [])
      const siteSummary = buildAggregateSummary(allSiteLots)

      return { id: site.id, name: site.name, summary: siteSummary, stages: stageAnalytics }
    })
    .filter((site) => site.stages.some((s) => s.lots.length > 0))

  return {
    rangeLabel,
    revenue: {
      invoiced: { total: invoicedTotal, count: invoicedLots.length, eligible: lotsWithQuotes.length },
      pipeline: { total: pipelineTotal, count: pipelineEligible.length, eligible: pipelineLots.length },
      avgComparison,
      excludedLotsCount,
      monthly,
      completedPerMonth,
    },
    materials,
    materialsBySite,
    materialsByStage,
    materialsSiteIndex,
    sites: siteAnalytics,
  }
}
