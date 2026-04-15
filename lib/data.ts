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
  console.log('[data] HAS_SERVICE_KEY:', HAS_SERVICE_KEY, '| registering:', key[0])
  return HAS_SERVICE_KEY
    ? (unstable_cache(serviceImpl, key, options) as (...args: TArgs) => Promise<TReturn>)
    : cache(clientImpl)
}

// ── Query implementations ─────────────────────────────────────────────────────

async function _sitesList(db: Db) {
  const { data, error } = await db
    .from('sites')
    .select('id, name, address, stages(id, lots(id, status))')
    .order('name', { ascending: true })
  console.log('[_sitesList] rows:', data?.length ?? 0, '| error:', error?.message ?? 'none')
  return data ?? []
}

async function _site(db: Db, siteId: string) {
  const { data, error } = await db
    .from('sites')
    .select('id, name, address, client_contact, site_plan_path, stages(id, name, order, lots(id, status))')
    .eq('id', siteId)
    .single()
  console.log('[_site]', siteId, '| error:', error?.message ?? 'none')
  return data
}

async function _stage(db: Db, stageId: string) {
  const [{ data: stage, error: stageError }, { data: extraJobs, error: jobsError }] = await Promise.all([
    db
      .from('stages')
      .select(`
        id, name, site_plan_path,
        sites!inner(id, name),
        lots(id, lot_number, status, due_date, scheduled_date)
      `)
      .eq('id', stageId)
      .single(),
    db
      .from('extra_jobs')
      .select('id, title, status, description')
      .eq('stage_id', stageId)
      .order('created_at', { ascending: true }),
  ])
  console.log('[_stage]', stageId, '| stage error:', stageError?.message ?? 'none', '| jobs error:', jobsError?.message ?? 'none')
  return { stage, extraJobs: extraJobs ?? [] }
}

async function _dashboardData(db: Db, fortnightStr: string) {
  const [{ data: lotsData, error: lotsError }, { data: sitesData, error: sitesError }] = await Promise.all([
    db
      .from('lots')
      .select('id, lot_number, due_date, stages!inner(id, name, sites!inner(id, name))')
      .neq('status', 'complete')
      .not('due_date', 'is', null)
      .lte('due_date', fortnightStr)
      .order('due_date', { ascending: true }),
    db
      .from('sites')
      .select('id, name, stages(lots(id, status))')
      .order('name', { ascending: true }),
  ])
  console.log('[_dashboardData] lots:', lotsData?.length ?? 0, '| lots error:', lotsError?.message ?? 'none', '| sites:', sitesData?.length ?? 0, '| sites error:', sitesError?.message ?? 'none')
  return { lotsData: lotsData ?? [], sitesData: sitesData ?? [] }
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
    .from('staff_members')
    .select('id, full_name, phone_number, credentials, role')
    .order('full_name', { ascending: true })
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
      notes, created_at
    `)
    .order('make', { ascending: true })
  return data ?? []
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

export const getCachedMaterialsTemplate = withCache(
  () => _materialsTemplate(createServiceClient()),
  async () => _materialsTemplate(await createClient() as Db),
  ['materials-template'],
  { tags: ['template'] }
)
