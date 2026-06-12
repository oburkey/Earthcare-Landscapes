// Computation helpers for the materials planning page.
//
// Garden bed area is derived from estimate quant-sheet mulch line items
// (garden bed area is conventionally entered against the mulch item).
// Item names match the live template seed (supabase/seed_phase2.sql):
//   Front m² = 'Mulch Limestone 32mm' + 'Black Mulch' + 'White Mulch'   (gravel excluded — not garden bed)
//   Rear m²  = 'Limestone Mulch' + 'Black Mulch'                        (gravel excluded — not garden bed)

export const FRONT_BED_ITEMS = ['Mulch Limestone 32mm', 'Black Mulch', 'White Mulch']
export const REAR_BED_ITEMS = ['Limestone Mulch', 'Black Mulch']
export const STREET_TREE_90L_ITEM = 'Feature Trees 90L'

export const DEFAULT_FRONT_RATIO = 2.0
export const DEFAULT_REAR_RATIO = 1.75
export const DEFAULT_POT_SIZE_SPLIT: Record<string, number> = { '130mm': 75, '200mm': 25 }

const POT_SIZE_LABELS: Record<string, string> = {
  '130mm': '130/140mm',
  '200mm': '200mm',
}

// ── Input shapes (from getCachedMaterialsPlanningData / getCachedPlantRatioSettings) ──

type QuoteItem = { item_name: string; quantity: number | null }
type LotQuote = { is_estimated: boolean; lot_quote_items: QuoteItem[] | null }
type Site = { id: string; name: string }
type LotDocument = { storage_path: string; document_type: string; created_at: string }

type StageWithSite = { id: string; name: string; sites: Site | Site[] }

export type MaterialsLotRow = {
  id: string
  lot_number: string
  due_date: string
  stages: StageWithSite | StageWithSite[] | null
  lot_quotes: LotQuote[] | null
  lot_documents: LotDocument[] | null
}

type TemplateItemRef = { name: string }
type ExtraJobItem = { quantity: number | null; quote_template_items: TemplateItemRef | TemplateItemRef[] | null }

export type MaterialsExtraJobRow = {
  id: string
  title: string
  due_date: string
  stages: StageWithSite | StageWithSite[] | null
  extra_job_quote_items: ExtraJobItem[] | null
}

// Supabase returns to-one relations as objects but types them as arrays when
// the relationship cardinality can't be inferred — normalize both forms.
function normalizeStage(stages: StageWithSite | StageWithSite[] | null): StageWithSite | null {
  if (!stages) return null
  return Array.isArray(stages) ? stages[0] ?? null : stages
}

function normalizeSite(sites: Site | Site[]): Site {
  return Array.isArray(sites) ? sites[0] : sites
}

export type RatioSettingRow = {
  site_id: string | null
  front_ratio: number
  rear_ratio: number
  pot_size_split: Record<string, number> | null
}

// ── Output shapes ──────────────────────────────────────────────────────────

export type PotSplitLine = { label: string; pct: number; count: number }

export type LotMaterial = {
  id: string
  lotNumber: string
  dueDate: string
  frontM2: number
  rearM2: number
  frontPlants: number
  rearPlants: number
  totalPlants: number
  streetTrees90L: number
  sitePlanPath: string | null
}

export type ExtraJobMaterial = {
  id: string
  title: string
  dueDate: string
  frontM2: number
  rearM2: number
  frontPlants: number
  rearPlants: number
  totalPlants: number
  streetTrees90L: number
}

export type SiteMaterialGroup = {
  siteId: string
  siteName: string
  lots: LotMaterial[]
  extraJobs: ExtraJobMaterial[]
  totals: {
    frontM2: number
    rearM2: number
    frontPlants: number
    rearPlants: number
    totalPlants: number
    potSplit: PotSplitLine[]
    streetTrees90L: number
  }
}

export type MonthMaterialGroup = {
  key: string
  label: string
  sites: SiteMaterialGroup[]
}

// ── Date range ──────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Returns the [startDate, endDate) range covering "now" plus the following
// two months, plus a label for each of those three months.
export function getMaterialsDateRange(now: Date = new Date()): {
  startDate: string
  endDate: string
  months: { key: string; label: string }[]
} {
  const months = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return {
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }),
    }
  })
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 1)
  return { startDate: isoDate(start), endDate: isoDate(end), months }
}

// ── Aggregation ─────────────────────────────────────────────────────────────

function sumByItemName(items: QuoteItem[] | null | undefined, names: string[]): number {
  if (!items) return 0
  return items
    .filter((i) => names.includes(i.item_name))
    .reduce((sum, i) => sum + (i.quantity ?? 0), 0)
}

function sumExtraJobItems(items: ExtraJobItem[] | null | undefined, names: string[]): number {
  if (!items) return 0
  return items
    .filter((i) => {
      const ref = i.quote_template_items
      const tpl = Array.isArray(ref) ? ref[0] : ref
      return tpl && names.includes(tpl.name)
    })
    .reduce((sum, i) => sum + (i.quantity ?? 0), 0)
}

function resolveRatios(siteId: string, settings: RatioSettingRow[]): {
  frontRatio: number
  rearRatio: number
  potSplit: Record<string, number>
} {
  const override = settings.find((s) => s.site_id === siteId)
  const global = settings.find((s) => s.site_id === null)
  const source = override ?? global
  return {
    frontRatio: source?.front_ratio ?? DEFAULT_FRONT_RATIO,
    rearRatio: source?.rear_ratio ?? DEFAULT_REAR_RATIO,
    potSplit: source?.pot_size_split ?? DEFAULT_POT_SIZE_SPLIT,
  }
}

function newSiteGroup(site: Site): SiteMaterialGroup {
  return {
    siteId: site.id,
    siteName: site.name,
    lots: [],
    extraJobs: [],
    totals: { frontM2: 0, rearM2: 0, frontPlants: 0, rearPlants: 0, totalPlants: 0, potSplit: [], streetTrees90L: 0 },
  }
}

// Most recently uploaded site plan PDF for a lot, or null if none uploaded.
function latestSitePlanPath(documents: LotDocument[] | null): string | null {
  const sitePlans = (documents ?? []).filter((d) => d.document_type === 'site_plan')
  if (sitePlans.length === 0) return null
  return sitePlans.reduce((latest, d) => (d.created_at > latest.created_at ? d : latest)).storage_path
}

export function buildMaterialsPlan(
  data: { lots: MaterialsLotRow[]; jobs: MaterialsExtraJobRow[] },
  ratioSettings: RatioSettingRow[],
  months: { key: string; label: string }[]
): MonthMaterialGroup[] {
  return months.map(({ key, label }) => {
    const siteGroups = new Map<string, SiteMaterialGroup>()

    for (const lot of data.lots) {
      if (lot.due_date.slice(0, 7) !== key) continue
      const stage = normalizeStage(lot.stages)
      if (!stage) continue
      const site = normalizeSite(stage.sites)
      const group = siteGroups.get(site.id) ?? newSiteGroup(site)
      siteGroups.set(site.id, group)

      const estimate = lot.lot_quotes?.find((q) => q.is_estimated)
      const items = estimate?.lot_quote_items ?? []
      const frontM2 = sumByItemName(items, FRONT_BED_ITEMS)
      const rearM2 = sumByItemName(items, REAR_BED_ITEMS)
      const streetTrees90L = sumByItemName(items, [STREET_TREE_90L_ITEM])
      const { frontRatio, rearRatio } = resolveRatios(site.id, ratioSettings)
      const frontPlants = Math.round(frontM2 * frontRatio)
      const rearPlants = Math.round(rearM2 * rearRatio)

      group.lots.push({
        id: lot.id,
        lotNumber: lot.lot_number,
        dueDate: lot.due_date,
        frontM2, rearM2, frontPlants, rearPlants,
        totalPlants: frontPlants + rearPlants,
        streetTrees90L,
        sitePlanPath: latestSitePlanPath(lot.lot_documents),
      })
      group.totals.frontM2 += frontM2
      group.totals.rearM2 += rearM2
      group.totals.streetTrees90L += streetTrees90L
    }

    for (const job of data.jobs) {
      if (job.due_date.slice(0, 7) !== key) continue
      const stage = normalizeStage(job.stages)
      if (!stage) continue
      const site = normalizeSite(stage.sites)
      const items = job.extra_job_quote_items ?? []
      const frontM2 = sumExtraJobItems(items, FRONT_BED_ITEMS)
      const rearM2 = sumExtraJobItems(items, REAR_BED_ITEMS)
      const streetTrees90L = sumExtraJobItems(items, [STREET_TREE_90L_ITEM])
      if (frontM2 === 0 && rearM2 === 0 && streetTrees90L === 0) continue

      const group = siteGroups.get(site.id) ?? newSiteGroup(site)
      siteGroups.set(site.id, group)

      const { frontRatio, rearRatio } = resolveRatios(site.id, ratioSettings)
      const frontPlants = Math.round(frontM2 * frontRatio)
      const rearPlants = Math.round(rearM2 * rearRatio)

      group.extraJobs.push({
        id: job.id,
        title: job.title,
        dueDate: job.due_date,
        frontM2, rearM2, frontPlants, rearPlants,
        totalPlants: frontPlants + rearPlants,
        streetTrees90L,
      })
      group.totals.frontM2 += frontM2
      group.totals.rearM2 += rearM2
      group.totals.streetTrees90L += streetTrees90L
    }

    const sites = Array.from(siteGroups.values())
      .map((group) => {
        const { frontRatio, rearRatio, potSplit } = resolveRatios(group.siteId, ratioSettings)
        const frontPlants = Math.round(group.totals.frontM2 * frontRatio)
        const rearPlants = Math.round(group.totals.rearM2 * rearRatio)
        const totalPlants = frontPlants + rearPlants
        const potSplitLines: PotSplitLine[] = Object.entries(potSplit).map(([k, pct]) => ({
          label: POT_SIZE_LABELS[k] ?? k,
          pct,
          count: Math.round(totalPlants * (pct / 100)),
        }))
        return {
          ...group,
          totals: { ...group.totals, frontPlants, rearPlants, totalPlants, potSplit: potSplitLines },
        }
      })
      .sort((a, b) => a.siteName.localeCompare(b.siteName))

    return { key, label, sites }
  })
}
