// Cached query functions for server components.
//
// Strategy:
//   SUPABASE_SERVICE_ROLE_KEY present → unstable_cache + service client
//     Cross-request cache, service role bypasses RLS, requires no session.
//   SUPABASE_SERVICE_ROLE_KEY absent  → React cache() + server client
//     Per-request deduplication only, uses the user's session so RLS applies.
//
// Mutations call revalidateTag() to bust the relevant unstable_cache entries.

import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createServiceClient } from './supabase/service'
import { createClient } from './supabase/server'

const HAS_SERVICE_KEY = !!process.env.SUPABASE_SERVICE_ROLE_KEY

// Shared client type — both createServiceClient() and createClient() return this.
type Db = ReturnType<typeof createServiceClient>

// ── Cache helpers ─────────────────────────────────────────────────────────────

// Wraps a db-query function in the appropriate cache layer.
// serviceImpl runs inside unstable_cache (no cookies available).
// clientImpl runs inside React cache (cookies available, request-scoped).
function withCache<TArgs extends unknown[], TReturn>(
  serviceImpl: (...args: TArgs) => Promise<TReturn>,
  clientImpl: (...args: TArgs) => Promise<TReturn>,
  key: string[],
  options: { tags: string[]; revalidate?: number }
): (...args: TArgs) => Promise<TReturn> {
  return HAS_SERVICE_KEY
    ? (unstable_cache(serviceImpl, key, options) as (...args: TArgs) => Promise<TReturn>)
    : cache(clientImpl)
}

// ── Query implementations ─────────────────────────────────────────────────────

async function _sitesList(db: Db) {
  const { data } = await db
    .from('sites')
    .select('id, name, address, completed_at, stages(id, lots(id, status))')
    .order('name', { ascending: true })
  return data ?? []
}

async function _site(db: Db, siteId: string) {
  const { data } = await db
    .from('sites')
    .select('id, name, address, client_contact, site_plan_path, has_client_extras, stages(id, name, order, completed_at, lots(id, status))')
    .eq('id', siteId)
    .single()
  return data
}

async function _stage(db: Db, stageId: string) {
  const [{ data: stage }, { data: extraJobs }] = await Promise.all([
    db
      .from('stages')
      .select(`
        id, name, site_plan_path, is_contract_pricing, default_contract_price,
        sites!inner(id, name),
        lots(id, lot_number, status, due_date, scheduled_date, build_complete)
      `)
      .eq('id', stageId)
      .single(),
    db
      .from('extra_jobs')
      .select('id, title, status, description, due_date')
      .eq('stage_id', stageId)
      .order('created_at', { ascending: true }),
  ])
  return { stage, extraJobs: extraJobs ?? [] }
}

async function _dashboardData(db: Db, fortnightStr: string) {
  const [{ data: lotsRaw }, { data: sitesData }] = await Promise.all([
    db
      .from('lots')
      .select('id, lot_number, due_date, stages!inner(id, name, sites!inner(id, name, completed_at))')
      .neq('status', 'complete')
      .not('due_date', 'is', null)
      .lte('due_date', fortnightStr)
      .order('due_date', { ascending: true }),
    db
      .from('sites')
      .select('id, name, stages(lots(id, status))')
      .is('completed_at', null)
      .order('name', { ascending: true }),
  ])

  // Exclude lots from sites that have been marked complete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lotsData = (lotsRaw ?? []).filter((lot) => !(lot.stages as any)?.sites?.completed_at)

  return { lotsData, sitesData: sitesData ?? [] }
}

async function _scheduleData(db: Db) {
  const [{ data: lots }, { data: jobs }] = await Promise.all([
    db
      .from('lots')
      .select('id, lot_number, status, due_date, stages!inner(id, name, sites!inner(id, name))')
      .not('due_date', 'is', null)
      .neq('status', 'complete')
      .order('due_date', { ascending: true }),
    db
      .from('extra_jobs')
      .select('id, title, status, due_date, stages!inner(id, name, sites!inner(id, name))')
      .not('due_date', 'is', null)
      .neq('status', 'complete')
      .order('due_date', { ascending: true }),
  ])
  return { lots: lots ?? [], jobs: jobs ?? [] }
}

async function _contacts(db: Db) {
  const { data } = await db
    .from('contacts')
    .select('id, name, company, phone, email, category, notes, created_at, updated_at')
    .order('name', { ascending: true })
  return data ?? []
}

async function _staff(db: Db) {
  const { data } = await db
    .from('profiles')
    .select('id, first_name, last_name, email, phone_number, credentials, role, has_login')
    .neq('role', 'client')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
  return data ?? []
}

async function _vehicles(db: Db) {
  const { data } = await db
    .from('vehicles')
    .select(`
      id, make, model, year, registration, assigned_to,
      rego_expiry_date, insurance_expiry_date,
      last_service_date, last_service_hours, last_service_odometer,
      next_service_due_date, next_service_km, next_service_hours,
      notes, vehicle_type, current_hours, current_hours_updated_at, created_at
    `)
    .order('make', { ascending: true })
  return data ?? []
}

// Trade status for a set of lots, keyed by lot_id. Returns {} for lots with
// no record, and gracefully returns {} entirely if the table doesn't exist yet.
async function _tradeStatusByLotIds(db: Db, lotIds: string[]) {
  if (lotIds.length === 0) return {}
  const { data, error } = await db
    .from('lot_trade_status')
    .select('lot_id, trades_completed, ready_for_landscaping')
    .in('lot_id', lotIds)
  if (error || !data) return {}
  const map: Record<string, { trades_completed: string[]; ready_for_landscaping: boolean }> = {}
  for (const row of data) {
    map[row.lot_id] = {
      trades_completed: row.trades_completed ?? [],
      ready_for_landscaping: row.ready_for_landscaping ?? false,
    }
  }
  return map
}

// Plant ratio settings (global default + per-site overrides). Gracefully
// returns [] if the table doesn't exist yet.
async function _plantRatioSettings(db: Db) {
  const { data, error } = await db
    .from('plant_ratio_settings')
    .select('id, site_id, front_ratio, rear_ratio, pot_size_split, front_pot_split, rear_pot_split, updated_at')
    .order('site_id', { ascending: true, nullsFirst: true })
  if (error || !data) return []
  return data
}

async function _materialsTemplate(db: Db) {
  const { data } = await db
    .from('quote_template_sections')
    .select(`
      id, name, order_index, is_active, admin_only,
      quote_template_items (
        id, name, unit, unit_price, is_auto_calculated,
        auto_calc_formula, plant_category, order_index, is_active
      )
    `)
    .order('order_index', { ascending: true })
  return data ?? []
}

// Lots and extra jobs due within [startDate, endDate), with their ESTIMATE
// quote line items (lots) and template-matched line items (extra jobs), for
// the materials planning page. Used to compute garden bed m² / plant counts.
async function _materialsPlanningData(db: Db, startDate: string, endDate: string) {
  const [{ data: lots }, { data: jobs }] = await Promise.all([
    db
      .from('lots')
      .select(`
        id, lot_number, due_date,
        stages!inner(id, name, sites!inner(id, name)),
        lot_quotes(is_estimated, lot_quote_items(item_name, quantity)),
        lot_documents(storage_path, document_type, created_at)
      `)
      .not('due_date', 'is', null)
      .gte('due_date', startDate)
      .lt('due_date', endDate)
      .neq('status', 'complete')
      .order('due_date', { ascending: true }),
    db
      .from('extra_jobs')
      .select(`
        id, title, due_date,
        stages!inner(id, name, sites!inner(id, name)),
        extra_job_quote_items(quantity, quote_template_items(name))
      `)
      .not('due_date', 'is', null)
      .gte('due_date', startDate)
      .lt('due_date', endDate)
      .neq('status', 'complete')
      .order('due_date', { ascending: true }),
  ])
  return { lots: lots ?? [], jobs: jobs ?? [] }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const getCachedSitesList = withCache(
  () => _sitesList(createServiceClient()),
  async () => _sitesList(await createClient() as Db),
  ['sites-list'],
  { tags: ['sites'] }
)

export const getCachedSite = withCache(
  (siteId: string) => _site(createServiceClient(), siteId),
  async (siteId: string) => _site(await createClient() as Db, siteId),
  ['site'],
  { tags: ['sites'] }
)

export const getCachedStage = withCache(
  (stageId: string) => _stage(createServiceClient(), stageId),
  async (stageId: string) => _stage(await createClient() as Db, stageId),
  ['stage'],
  { tags: ['stages'], revalidate: 60 }
)

export const getCachedDashboardData = withCache(
  (fortnightStr: string) => _dashboardData(createServiceClient(), fortnightStr),
  async (fortnightStr: string) => _dashboardData(await createClient() as Db, fortnightStr),
  ['dashboard'],
  { tags: ['dashboard', 'sites'], revalidate: 300 }
)

export const getCachedScheduleData = withCache(
  () => _scheduleData(createServiceClient()),
  async () => _scheduleData(await createClient() as Db),
  ['schedule-data'],
  { tags: ['schedule'], revalidate: 300 }
)

export const getCachedContacts = withCache(
  () => _contacts(createServiceClient()),
  async () => _contacts(await createClient() as Db),
  ['contacts-list'],
  { tags: ['contacts'] }
)

export const getCachedStaff = withCache(
  () => _staff(createServiceClient()),
  async () => _staff(await createClient() as Db),
  ['staff-list'],
  { tags: ['staff'] }
)

export const getCachedVehicles = withCache(
  () => _vehicles(createServiceClient()),
  async () => _vehicles(await createClient() as Db),
  ['vehicles-list'],
  { tags: ['vehicles'] }
)

export const getCachedTradeStatusByLotIds = withCache(
  (lotIds: string[]) => _tradeStatusByLotIds(createServiceClient(), lotIds),
  async (lotIds: string[]) => _tradeStatusByLotIds(await createClient() as Db, lotIds),
  ['trade-status-by-lot-ids'],
  { tags: ['trade-status'], revalidate: 60 }
)

export const getCachedMaterialsTemplate = withCache(
  () => _materialsTemplate(createServiceClient()),
  async () => _materialsTemplate(await createClient() as Db),
  ['materials-template'],
  { tags: ['template'] }
)

export const getCachedPlantRatioSettings = withCache(
  () => _plantRatioSettings(createServiceClient()),
  async () => _plantRatioSettings(await createClient() as Db),
  ['plant-ratio-settings'],
  { tags: ['plant-ratios'] }
)

export const getCachedMaterialsPlanningData = withCache(
  (startDate: string, endDate: string) => _materialsPlanningData(createServiceClient(), startDate, endDate),
  async (startDate: string, endDate: string) => _materialsPlanningData(await createClient() as Db, startDate, endDate),
  ['materials-planning-data'],
  { tags: ['schedule', 'quotes'], revalidate: 300 }
)
