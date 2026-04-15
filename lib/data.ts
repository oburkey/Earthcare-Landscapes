// Cached query functions for server components.
// Uses unstable_cache so Supabase is only queried on cache miss.
// Mutations call revalidateTag() to bust the relevant entries.

import { unstable_cache } from 'next/cache'
import { createServiceClient } from './supabase/service'

// ── Sites list ────────────────────────────────────────────────────────────────
// Used by: /sites, /dashboard

export const getCachedSitesList = unstable_cache(
  async () => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('sites')
      .select('id, name, address, stages(id, lots(id, status))')
      .order('name', { ascending: true })
    return data ?? []
  },
  ['sites-list'],
  { tags: ['sites'] }
)

// ── Site detail ───────────────────────────────────────────────────────────────
// Used by: /sites/[siteId]

export const getCachedSite = unstable_cache(
  async (siteId: string) => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('sites')
      .select('id, name, address, client_contact, site_plan_path, stages(id, name, order, lots(id, status))')
      .eq('id', siteId)
      .single()
    return data
  },
  ['site'],
  { tags: ['sites'] }
)

// ── Stage detail ──────────────────────────────────────────────────────────────
// Used by: /sites/[siteId]/stages/[stageId]
// Short revalidate ensures lot-status changes are visible within a minute
// even if revalidateTag('stages') was missed.

export const getCachedStage = unstable_cache(
  async (stageId: string) => {
    const supabase = createServiceClient()
    const [{ data: stage }, { data: extraJobs }] = await Promise.all([
      supabase
        .from('stages')
        .select(`
          id, name, site_plan_path,
          sites!inner(id, name),
          lots(id, lot_number, status, due_date, scheduled_date)
        `)
        .eq('id', stageId)
        .single(),
      supabase
        .from('extra_jobs')
        .select('id, title, status, description')
        .eq('stage_id', stageId)
        .order('created_at', { ascending: true }),
    ])
    return { stage, extraJobs: extraJobs ?? [] }
  },
  ['stage'],
  { tags: ['stages'], revalidate: 60 }
)

// ── Dashboard data ────────────────────────────────────────────────────────────
// Used by: /dashboard
// fortnightStr is the date-based upper bound — changing daily busts the key.

export const getCachedDashboardData = unstable_cache(
  async (fortnightStr: string) => {
    const supabase = createServiceClient()
    const [{ data: lotsData }, { data: sitesData }] = await Promise.all([
      supabase
        .from('lots')
        .select('id, lot_number, due_date, stages!inner(id, name, sites!inner(id, name))')
        .neq('status', 'complete')
        .not('due_date', 'is', null)
        .lte('due_date', fortnightStr)
        .order('due_date', { ascending: true }),
      supabase
        .from('sites')
        .select('id, name, stages(lots(id, status))')
        .order('name', { ascending: true }),
    ])
    return { lotsData: lotsData ?? [], sitesData: sitesData ?? [] }
  },
  ['dashboard'],
  { tags: ['dashboard', 'sites'], revalidate: 300 }
)

// ── Schedule data ─────────────────────────────────────────────────────────────
// Used by: /schedule

export const getCachedScheduleData = unstable_cache(
  async () => {
    const supabase = createServiceClient()
    const [{ data: lots }, { data: jobs }] = await Promise.all([
      supabase
        .from('lots')
        .select('id, lot_number, status, due_date, stages!inner(id, name, sites!inner(id, name))')
        .not('due_date', 'is', null)
        .neq('status', 'complete')
        .order('due_date', { ascending: true }),
      supabase
        .from('extra_jobs')
        .select('id, title, status, due_date, stages!inner(id, name, sites!inner(id, name))')
        .not('due_date', 'is', null)
        .neq('status', 'complete')
        .order('due_date', { ascending: true }),
    ])
    return { lots: lots ?? [], jobs: jobs ?? [] }
  },
  ['schedule-data'],
  { tags: ['schedule'], revalidate: 300 }
)

// ── Contacts ──────────────────────────────────────────────────────────────────
// Used by: /contacts

export const getCachedContacts = unstable_cache(
  async () => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('contacts')
      .select('id, name, company, phone, email, category, notes, created_at, updated_at')
      .order('name', { ascending: true })
    return data ?? []
  },
  ['contacts-list'],
  { tags: ['contacts'] }
)

// ── Staff ─────────────────────────────────────────────────────────────────────
// Used by: /staff

export const getCachedStaff = unstable_cache(
  async () => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('staff_members')
      .select('id, full_name, phone_number, credentials, role')
      .order('full_name', { ascending: true })
    return data ?? []
  },
  ['staff-list'],
  { tags: ['staff'] }
)

// ── Vehicles ──────────────────────────────────────────────────────────────────
// Used by: /vehicles

export const getCachedVehicles = unstable_cache(
  async () => {
    const supabase = createServiceClient()
    const { data } = await supabase
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
  },
  ['vehicles-list'],
  { tags: ['vehicles'] }
)

// ── Materials template ────────────────────────────────────────────────────────
// Used by: /settings/materials, lot page (template sections)

export const getCachedMaterialsTemplate = unstable_cache(
  async () => {
    const supabase = createServiceClient()
    const { data } = await supabase
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
  },
  ['materials-template'],
  { tags: ['template'] }
)
