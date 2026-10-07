// Quant sheet / invoicing data-quality checks, shared by:
//   - the admin-only warning banners on the lot detail page and invoices page
//   - the weekly issues email (app/api/send-issues-email)
//
// Each check is a small, independent, synchronous function over a shared,
// pre-fetched snapshot of active-site data — new checks can be added by
// writing another `checkXxx` function and splicing its result into
// getQuantIssues() below. Uses the service-role client (like lib/emails/data.ts)
// since this needs to run from a cron route with no logged-in user, and the
// app call sites are already admin-gated before calling in.

import { createAdminClient } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
const VARIANCE_THRESHOLD = 0.25

// ── Public shape ──────────────────────────────────────────────────────────────

export type QuantIssueRow = {
  site_id: string
  site: string
  stage_id: string
  stage: string
  lot_id: string       // the extra job's id, for entity_type 'extra_job'
  lot_number: string   // the extra job's title, for entity_type 'extra_job'
  quote_type: 'estimate' | 'budget' | 'final' | null
  issue: string
  entity_type: 'lot' | 'extra_job'
  invoiced: boolean
}

// ── Shared fetched data shapes ────────────────────────────────────────────────

type QuoteType = 'estimate' | 'budget' | 'final'

type LotQuoteItemRow = {
  template_item_id: string | null
  quantity: number | null
  unit_price_snapshot: number | null
}

type LotQuoteRow = {
  quote_type: QuoteType
  items: LotQuoteItemRow[]
}

type ActiveLotRow = {
  id: string
  lot_number: string
  build_complete: boolean
  invoiced: boolean
  approved_for_invoicing: boolean
  approved_for_invoicing_at: string | null
  contract_price: number | null
  has_client_extras: boolean
  site_id: string
  site_name: string
  site_has_client_extras: boolean
  stage_id: string
  stage_name: string
  is_contract_pricing: boolean
  default_contract_price: number | null
  quotes: LotQuoteRow[]
}

type ActiveExtraJobRow = {
  id: string
  title: string
  status: string
  approved_for_invoicing: boolean
  approved_for_invoicing_at: string | null
  invoiced: boolean
  site_id: string
  site_name: string
  stage_id: string
  stage_name: string
}

type TemplateSection = {
  name: string
  isClientExtra: boolean
  isAdminOnly: boolean
  itemIds: string[]
}

type TemplateStructure = {
  adminOnlyItems: { id: string; name: string }[]
  cornerLotFlagItemId: string | null
  sections: TemplateSection[]
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function getTemplateStructure(db: Db): Promise<TemplateStructure> {
  const { data } = await db
    .from('quote_template_items')
    .select('id, name, auto_calc_formula, quote_template_sections!inner(name, admin_only, is_client_extra, is_active)')
    .eq('is_active', true)
    .eq('quote_template_sections.is_active', true)

  const adminOnlyItems: { id: string; name: string }[] = []
  let cornerLotFlagItemId: string | null = null
  const sectionMap = new Map<string, TemplateSection>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const section = Array.isArray(row.quote_template_sections) ? row.quote_template_sections[0] : row.quote_template_sections
    if (!section) continue
    if (section.admin_only) adminOnlyItems.push({ id: row.id, name: row.name })
    if (row.auto_calc_formula === 'corner_lot_flag') cornerLotFlagItemId = row.id
    if (!sectionMap.has(section.name)) {
      sectionMap.set(section.name, {
        name: section.name,
        isClientExtra: !!section.is_client_extra,
        isAdminOnly: !!section.admin_only,
        itemIds: [],
      })
    }
    sectionMap.get(section.name)!.itemIds.push(row.id)
  }

  return { adminOnlyItems, cornerLotFlagItemId, sections: [...sectionMap.values()] }
}

async function getActiveLotsWithQuotes(db: Db): Promise<ActiveLotRow[]> {
  const { data } = await db
    .from('lots')
    .select(`
      id, lot_number, build_complete, invoiced, approved_for_invoicing, approved_for_invoicing_at,
      contract_price, has_client_extras,
      stages!inner(id, name, is_contract_pricing, default_contract_price, sites!inner(id, name, completed_at, has_client_extras))
    `)

  const { data: quoteData } = await db
    .from('lot_quotes')
    .select('lot_id, quote_type, lot_quote_items(template_item_id, quantity, unit_price_snapshot)')

  const quotesByLotId = new Map<string, LotQuoteRow[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const q of (quoteData ?? []) as any[]) {
    const list = quotesByLotId.get(q.lot_id) ?? []
    list.push({
      quote_type: q.quote_type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: ((q.lot_quote_items ?? []) as any[]).map((i) => ({
        template_item_id: i.template_item_id,
        quantity: i.quantity != null ? Number(i.quantity) : null,
        unit_price_snapshot: i.unit_price_snapshot != null ? Number(i.unit_price_snapshot) : null,
      })),
    })
    quotesByLotId.set(q.lot_id, list)
  }

  const rows: ActiveLotRow[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const stage = Array.isArray(row.stages) ? row.stages[0] : row.stages
    const site = stage ? (Array.isArray(stage.sites) ? stage.sites[0] : stage.sites) : null
    if (!stage || !site || site.completed_at) continue
    rows.push({
      id: row.id,
      lot_number: row.lot_number,
      build_complete: row.build_complete,
      invoiced: row.invoiced,
      approved_for_invoicing: row.approved_for_invoicing,
      approved_for_invoicing_at: row.approved_for_invoicing_at,
      contract_price: row.contract_price != null ? Number(row.contract_price) : null,
      has_client_extras: row.has_client_extras,
      site_id: site.id,
      site_name: site.name,
      site_has_client_extras: site.has_client_extras,
      stage_id: stage.id,
      stage_name: stage.name,
      is_contract_pricing: stage.is_contract_pricing,
      default_contract_price: stage.default_contract_price != null ? Number(stage.default_contract_price) : null,
      quotes: quotesByLotId.get(row.id) ?? [],
    })
  }
  return rows
}

async function getActiveExtraJobs(db: Db): Promise<ActiveExtraJobRow[]> {
  const { data } = await db
    .from('extra_jobs')
    .select(`
      id, title, status, approved_for_invoicing, approved_for_invoicing_at, invoiced,
      stages!inner(id, name, sites!inner(id, name, completed_at))
    `)

  const rows: ActiveExtraJobRow[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const stage = Array.isArray(row.stages) ? row.stages[0] : row.stages
    const site = stage ? (Array.isArray(stage.sites) ? stage.sites[0] : stage.sites) : null
    if (!stage || !site || site.completed_at) continue
    rows.push({
      id: row.id,
      title: row.title,
      status: row.status,
      approved_for_invoicing: row.approved_for_invoicing,
      approved_for_invoicing_at: row.approved_for_invoicing_at,
      invoiced: row.invoiced,
      site_id: site.id,
      site_name: site.name,
      stage_id: stage.id,
      stage_name: stage.name,
    })
  }
  return rows
}

async function getInvoicedLotIds(db: Db): Promise<Set<string>> {
  const { data } = await db.from('invoice_runs').select('lot_ids')
  const ids = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    for (const id of row.lot_ids ?? []) ids.add(id)
  }
  return ids
}

// ── Row builders ──────────────────────────────────────────────────────────────

function lotIssue(lot: ActiveLotRow, quoteType: QuoteType | null, issue: string): QuantIssueRow {
  return {
    site_id: lot.site_id, site: lot.site_name,
    stage_id: lot.stage_id, stage: lot.stage_name,
    lot_id: lot.id, lot_number: lot.lot_number,
    quote_type: quoteType, issue,
    entity_type: 'lot', invoiced: lot.invoiced,
  }
}

function extraJobIssue(job: ActiveExtraJobRow, issue: string): QuantIssueRow {
  return {
    site_id: job.site_id, site: job.site_name,
    stage_id: job.stage_id, stage: job.stage_name,
    lot_id: job.id, lot_number: job.title,
    quote_type: null, issue,
    entity_type: 'extra_job', invoiced: job.invoiced,
  }
}

function sectionItemCount(items: LotQuoteItemRow[], itemIds: string[]): number {
  return items.filter((i) => i.template_item_id && itemIds.includes(i.template_item_id) && (i.quantity ?? 0) > 0).length
}

function quoteTotal(items: LotQuoteItemRow[]): number {
  return items.reduce((sum, i) => sum + (i.quantity != null && i.unit_price_snapshot != null ? i.quantity * i.unit_price_snapshot : 0), 0)
}

// ── Checks ────────────────────────────────────────────────────────────────────

// 1. Preliminaries (admin_only section) items missing on any estimate/budget/final sheet.
function checkPreliminariesMissing(lots: ActiveLotRow[], template: TemplateStructure): QuantIssueRow[] {
  if (template.adminOnlyItems.length === 0) return []
  const rows: QuantIssueRow[] = []
  for (const lot of lots) {
    for (const quote of lot.quotes) {
      const presentIds = new Set(quote.items.map((i) => i.template_item_id))
      const missing = template.adminOnlyItems.filter((item) => !presentIds.has(item.id))
      if (missing.length > 0) {
        rows.push(lotIssue(lot, quote.quote_type, `Missing Preliminaries item${missing.length === 1 ? '' : 's'}: ${missing.map((m) => m.name).join(', ')}`))
      }
    }
  }
  return rows
}

// 2. A whole (non-client-extra, non-admin-only) section has items on the
// Estimate but none on the Final.
function checkSectionEmptyOnFinal(lots: ActiveLotRow[], template: TemplateStructure): QuantIssueRow[] {
  const standardSections = template.sections.filter((s) => !s.isClientExtra && !s.isAdminOnly)
  if (standardSections.length === 0) return []
  const rows: QuantIssueRow[] = []
  for (const lot of lots) {
    const estimate = lot.quotes.find((q) => q.quote_type === 'estimate')
    const final = lot.quotes.find((q) => q.quote_type === 'final')
    if (!estimate || !final) continue
    for (const section of standardSections) {
      const estimateHas = sectionItemCount(estimate.items, section.itemIds) > 0
      const finalHas = sectionItemCount(final.items, section.itemIds) > 0
      if (estimateHas && !finalHas) {
        rows.push(lotIssue(lot, 'final', `${section.name} has items on the Estimate but none on the Final`))
      }
    }
  }
  return rows
}

// 3. Corner lot on in the Estimate but off in the Final.
function checkCornerLotMismatch(lots: ActiveLotRow[], template: TemplateStructure): QuantIssueRow[] {
  if (!template.cornerLotFlagItemId) return []
  const rows: QuantIssueRow[] = []
  for (const lot of lots) {
    const estimate = lot.quotes.find((q) => q.quote_type === 'estimate')
    const final = lot.quotes.find((q) => q.quote_type === 'final')
    if (!estimate || !final) continue
    const estimateOn = estimate.items.some((i) => i.template_item_id === template.cornerLotFlagItemId && i.quantity === 1)
    const finalOn = final.items.some((i) => i.template_item_id === template.cornerLotFlagItemId && i.quantity === 1)
    if (estimateOn && !finalOn) {
      rows.push(lotIssue(lot, 'final', 'Corner lot is on in the Estimate but off in the Final'))
    }
  }
  return rows
}

// 4. Client Extras on the Estimate but none on the Final.
function checkClientExtrasMissingOnFinal(lots: ActiveLotRow[], template: TemplateStructure): QuantIssueRow[] {
  const extrasSection = template.sections.find((s) => s.isClientExtra)
  if (!extrasSection) return []
  const rows: QuantIssueRow[] = []
  for (const lot of lots) {
    if (!lot.has_client_extras || !lot.site_has_client_extras) continue
    const estimate = lot.quotes.find((q) => q.quote_type === 'estimate')
    const final = lot.quotes.find((q) => q.quote_type === 'final')
    if (!estimate || !final) continue
    const estimateHas = sectionItemCount(estimate.items, extrasSection.itemIds) > 0
    const finalHas = sectionItemCount(final.items, extrasSection.itemIds) > 0
    if (estimateHas && !finalHas) {
      rows.push(lotIssue(lot, 'final', 'Client Extras has items on the Estimate but none on the Final'))
    }
  }
  return rows
}

// 5. Extra jobs with status complete but not approved_for_invoicing or invoiced.
function checkExtraJobCompleteNotApproved(extraJobs: ActiveExtraJobRow[]): QuantIssueRow[] {
  return extraJobs
    .filter((j) => j.status === 'complete' && !j.approved_for_invoicing && !j.invoiced)
    .map((j) => extraJobIssue(j, 'Complete but not approved for invoicing or invoiced'))
}

// 6. Lots with build_complete but no Final quant sheet.
function checkBuildCompleteNoFinal(lots: ActiveLotRow[]): QuantIssueRow[] {
  return lots
    .filter((lot) => lot.build_complete && !lot.quotes.some((q) => q.quote_type === 'final'))
    .map((lot) => lotIssue(lot, null, 'Build complete but no Final quant sheet'))
}

// 7. Lots/extra jobs approved_for_invoicing for more than 14 days without being invoiced.
function checkApprovedTooLong(lots: ActiveLotRow[], extraJobs: ActiveExtraJobRow[]): QuantIssueRow[] {
  const cutoff = Date.now() - FOURTEEN_DAYS_MS
  const rows: QuantIssueRow[] = []
  for (const lot of lots) {
    if (lot.approved_for_invoicing && !lot.invoiced && lot.approved_for_invoicing_at
      && new Date(lot.approved_for_invoicing_at).getTime() < cutoff) {
      rows.push(lotIssue(lot, null, 'Approved for invoicing more than 14 days ago, still not invoiced'))
    }
  }
  for (const job of extraJobs) {
    if (job.approved_for_invoicing && !job.invoiced && job.approved_for_invoicing_at
      && new Date(job.approved_for_invoicing_at).getTime() < cutoff) {
      rows.push(extraJobIssue(job, 'Approved for invoicing more than 14 days ago, still not invoiced'))
    }
  }
  return rows
}

// 8. Lots on a contract-priced stage with no lot-level contract_price (using the stage default).
function checkContractPriceMissing(lots: ActiveLotRow[]): QuantIssueRow[] {
  return lots
    .filter((lot) => lot.is_contract_pricing && lot.contract_price == null && lot.default_contract_price != null)
    .map((lot) => lotIssue(lot, null, `No lot-level contract price set — using the stage default of $${lot.default_contract_price!.toFixed(2)}`))
}

// 9. Final total differing from Estimate total by more than 25%.
function checkFinalVsEstimateVariance(lots: ActiveLotRow[]): QuantIssueRow[] {
  const rows: QuantIssueRow[] = []
  for (const lot of lots) {
    const estimate = lot.quotes.find((q) => q.quote_type === 'estimate')
    const final = lot.quotes.find((q) => q.quote_type === 'final')
    if (!estimate || !final) continue
    const estimateTotal = quoteTotal(estimate.items)
    if (estimateTotal <= 0) continue
    const finalTotal = quoteTotal(final.items)
    const variance = Math.abs(finalTotal - estimateTotal) / estimateTotal
    if (variance > VARIANCE_THRESHOLD) {
      const pct = Math.round(variance * 100)
      rows.push(lotIssue(lot, 'final', `Final total ($${finalTotal.toFixed(2)}) differs from Estimate ($${estimateTotal.toFixed(2)}) by ${pct}%`))
    }
  }
  return rows
}

// 10. Lots marked invoiced that aren't in any invoice_run.
function checkInvoicedNotInRun(lots: ActiveLotRow[], invoicedLotIds: Set<string>): QuantIssueRow[] {
  return lots
    .filter((lot) => lot.invoiced && !invoicedLotIds.has(lot.id))
    .map((lot) => lotIssue(lot, null, 'Marked invoiced but not found in any invoice run'))
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function getQuantIssues(): Promise<QuantIssueRow[]> {
  const db = createAdminClient()
  const [template, lots, extraJobs, invoicedLotIds] = await Promise.all([
    getTemplateStructure(db),
    getActiveLotsWithQuotes(db),
    getActiveExtraJobs(db),
    getInvoicedLotIds(db),
  ])

  return [
    ...checkPreliminariesMissing(lots, template),
    ...checkSectionEmptyOnFinal(lots, template),
    ...checkCornerLotMismatch(lots, template),
    ...checkClientExtrasMissingOnFinal(lots, template),
    ...checkExtraJobCompleteNotApproved(extraJobs),
    ...checkBuildCompleteNoFinal(lots),
    ...checkApprovedTooLong(lots, extraJobs),
    ...checkContractPriceMissing(lots),
    ...checkFinalVsEstimateVariance(lots),
    ...checkInvoicedNotInRun(lots, invoicedLotIds),
  ]
}
