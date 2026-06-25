import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getCachedDashboardData, getCachedTradeStatusByLotIds, getCachedMaterialsPlanningData, getCachedPlantRatioSettings } from '@/lib/data'
import { FRONT_BED_ITEMS, REAR_BED_ITEMS, DEFAULT_FRONT_RATIO, DEFAULT_REAR_RATIO } from '@/app/(app)/materials/lib'
import Greeting from './Greeting'
import FortnightCalendar, { type CalendarItem } from './FortnightCalendar'
import ExtraJobsList, { type ExtraJobItem } from './ExtraJobsList'
import PreStartsWeek, { type PreStartDay } from './PreStartsWeek'
import type { ExtraJobStatus } from '@/types/database'

export const metadata = { title: 'Dashboard — Earthcare Landscapes' }

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default async function DashboardPage() {
  const profile = await requireAuth()
  const isLeadingHand = ['leading_hand', 'supervisor', 'admin'].includes(profile.role)
  const isSupervisor = ['supervisor', 'admin'].includes(profile.role)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toYmd(today)

  const fortnight = new Date(today)
  fortnight.setDate(fortnight.getDate() + 14)
  const fortnightStr = toYmd(fortnight)

  // ── Data fetching ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lotsData: any[] = []
  let tradeStatus: Record<string, { trades_completed: string[]; ready_for_landscaping: boolean }> = {}
  let totalPlants = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let extraJobs: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let preStarts: any[] = []
  let vehicleAlertCount = 0
  let incidentCount = 0

  try {
    const { lotsData: ld } = await getCachedDashboardData(fortnightStr)
    lotsData = ld
    tradeStatus = await getCachedTradeStatusByLotIds(lotsData.map((l: { id: string }) => l.id))
  } catch {
    // graceful fallback
  }

  if (isLeadingHand) {
    // Plant count for next 2 weeks
    try {
      const { lots: matLots } = await getCachedMaterialsPlanningData(todayStr, fortnightStr)
      const ratioSettings = await getCachedPlantRatioSettings()

      for (const lot of matLots) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lotAny = lot as any
        const estimate = lotAny.lot_quotes?.find((q: { is_estimated: boolean }) => q.is_estimated)
        const items = estimate?.lot_quote_items ?? []
        const stage = Array.isArray(lotAny.stages) ? lotAny.stages[0] : lotAny.stages
        const site = stage ? (Array.isArray(stage.sites) ? stage.sites[0] : stage.sites) : null
        const siteId = site?.id ?? ''

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const override = ratioSettings.find((s: any) => s.site_id === siteId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const global = ratioSettings.find((s: any) => s.site_id === null)
        const src = override ?? global
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const frontRatio = (src as any)?.front_ratio ?? DEFAULT_FRONT_RATIO
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rearRatio = (src as any)?.rear_ratio ?? DEFAULT_REAR_RATIO

        let frontM2 = 0, rearM2 = 0
        for (const item of items) {
          const qty = Number(item.quantity ?? 0)
          if (FRONT_BED_ITEMS.includes(item.item_name)) frontM2 += qty
          if (REAR_BED_ITEMS.includes(item.item_name)) rearM2 += qty
        }
        totalPlants += Math.round(frontM2 * frontRatio) + Math.round(rearM2 * rearRatio)
      }
    } catch {
      // graceful fallback
    }

    // Extra jobs
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('extra_jobs')
        .select('id, title, status, due_date, stages!inner(id, name, sites!inner(id, name))')
        .neq('status', 'complete')
        .order('due_date', { ascending: true, nullsFirst: false })
      extraJobs = data ?? []
    } catch {
      // graceful fallback
    }
  }

  if (isSupervisor) {
    const supabase = await createClient()

    // Pre-starts this week (Mon-Fri)
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(monday.getDate() + mondayOffset)
    const friday = new Date(monday)
    friday.setDate(friday.getDate() + 4)

    try {
      const { data } = await supabase
        .from('pre_starts')
        .select('id, site_id, date, sites(name)')
        .gte('date', toYmd(monday))
        .lte('date', toYmd(friday))
        .order('date')
      preStarts = data ?? []
    } catch {
      // table may not exist
    }

    // Vehicles with rego/service due in 7 days
    const weekAhead = new Date(today)
    weekAhead.setDate(weekAhead.getDate() + 7)
    const weekAheadStr = toYmd(weekAhead)

    try {
      const { data } = await supabase
        .from('vehicles')
        .select('id, rego_expiry_date, next_service_due_date')
        .or(`rego_expiry_date.lte.${weekAheadStr},next_service_due_date.lte.${weekAheadStr}`)
      vehicleAlertCount = (data ?? []).length
    } catch {
      // graceful fallback
    }

    // Recent incidents
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    try {
      const { data } = await supabase
        .from('incidents')
        .select('id')
        .gte('date', toYmd(weekAgo))
      incidentCount = (data ?? []).length
    } catch {
      // table may not exist
    }
  }

  // ── Derive metrics ─────────────────────────────────────────────────────────

  const blockedCount = lotsData.filter((lot: { id: string }) => {
    const ts = tradeStatus[lot.id]
    return ts && !ts.ready_for_landscaping
  }).length

  // ── Calendar items ─────────────────────────────────────────────────────────

  const calendarItems: CalendarItem[] = []

  for (const lot of lotsData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lotAny = lot as any
    const stage = lotAny.stages
    const site = stage?.sites
    if (!site || !lotAny.due_date) continue
    calendarItems.push({
      date: lotAny.due_date,
      label: `Lot ${lotAny.lot_number}`,
      siteName: site.name,
      type: 'lot',
      href: `/sites/${site.id}/stages/${stage.id}/lots/${lotAny.id}`,
    })
  }

  for (const job of extraJobs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobAny = job as any
    const stage = Array.isArray(jobAny.stages) ? jobAny.stages[0] : jobAny.stages
    const site = stage ? (Array.isArray(stage.sites) ? stage.sites[0] : stage.sites) : null
    if (!site || !jobAny.due_date) continue
    calendarItems.push({
      date: jobAny.due_date,
      label: jobAny.title,
      siteName: site.name,
      type: 'job',
      href: `/sites/${site.id}/stages/${stage.id}/extra-jobs/${jobAny.id}`,
    })
  }

  // ── Extra jobs list ────────────────────────────────────────────────────────

  const extraJobItems: ExtraJobItem[] = extraJobs.map((job) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobAny = job as any
    const stage = Array.isArray(jobAny.stages) ? jobAny.stages[0] : jobAny.stages
    const site = stage ? (Array.isArray(stage.sites) ? stage.sites[0] : stage.sites) : null
    return {
      id: jobAny.id,
      title: jobAny.title,
      siteName: site?.name ?? '',
      siteId: site?.id ?? '',
      stageId: stage?.id ?? '',
      dueDate: jobAny.due_date ?? null,
      status: jobAny.status as ExtraJobStatus,
    }
  })

  // ── Pre-starts week ────────────────────────────────────────────────────────

  const preStartDays: PreStartDay[] = []
  if (isSupervisor) {
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(monday.getDate() + mondayOffset)

    for (let i = 0; i < 5; i++) {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      const dateStr = toYmd(d)
      const dayLabel = d.toLocaleDateString('en-AU', { weekday: 'short' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const daySites = preStarts
        .filter((ps: { date: string }) => ps.date === dateStr)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((ps: any) => {
          const site = Array.isArray(ps.sites) ? ps.sites[0] : ps.sites
          return site?.name ?? ''
        })
        .filter(Boolean)

      const uniqueSites = [...new Set(daySites)]
      const isFuture = dateStr > todayStr

      preStartDays.push({ label: dayLabel, date: dateStr, sites: uniqueSites, isFuture })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">

        <Greeting name={profile.full_name} />

        {/* Section 1 — Summary cards (leading_hand+) */}
        {isLeadingHand && (
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Due this fortnight"
              value={lotsData.length}
              color="blue"
              href="/schedule"
            />
            <MetricCard
              label="Blocked lots"
              value={blockedCount}
              color={blockedCount > 0 ? 'amber' : 'green'}
              href="/schedule"
            />
            <MetricCard
              label="Upcoming plants"
              value={totalPlants}
              color="green"
              href="/materials"
            />
          </div>
        )}

        {/* Section 2 — Fortnight calendar (leading_hand+) */}
        {isLeadingHand && (
          <section>
            <h2 className="text-base font-semibold text-stone-800 mb-3">Next 2 weeks</h2>
            <FortnightCalendar items={calendarItems} />
          </section>
        )}

        {/* Section 3 — Extra jobs to complete (leading_hand+, hidden if empty) */}
        {isLeadingHand && <ExtraJobsList jobs={extraJobItems} />}

        {/* Section 4 — Pre-starts this week (supervisor+) */}
        {isSupervisor && preStartDays.length > 0 && (
          <PreStartsWeek days={preStartDays} />
        )}

        {/* Section 5 — Needs attention (supervisor+, hidden if nothing) */}
        {isSupervisor && (vehicleAlertCount > 0 || incidentCount > 0) && (
          <section>
            <h2 className="text-base font-semibold text-stone-800 mb-3">Needs attention</h2>
            <div className="grid grid-cols-2 gap-3">
              {vehicleAlertCount > 0 && (
                <Link href="/vehicles" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-colors">
                  <p className="text-xl font-bold text-amber-700">{vehicleAlertCount}</p>
                  <p className="text-xs text-amber-600">Rego / service due in 7 days</p>
                </Link>
              )}
              {incidentCount > 0 && (
                <Link href="/safety" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 hover:bg-red-100 transition-colors">
                  <p className="text-xl font-bold text-red-700">{incidentCount}</p>
                  <p className="text-xs text-red-600">Incident{incidentCount !== 1 ? 's' : ''} in last 7 days</p>
                </Link>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}

// ── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, color, href,
}: {
  label: string
  value: number
  color: 'blue' | 'amber' | 'red' | 'green'
  href?: string
}) {
  const colors = {
    blue:  'text-blue-700',
    amber: 'text-amber-700',
    red:   'text-red-700',
    green: 'text-green-700',
  }

  const inner = (
    <div className={`rounded-xl border border-stone-200 bg-white px-3 py-3.5 flex flex-col gap-1${href ? ' hover:bg-stone-50 transition-colors' : ''}`}>
      <span className={`text-2xl font-bold ${colors[color]}`}>
        {value.toLocaleString('en-AU')}
      </span>
      <span className="text-xs text-stone-500 leading-tight">{label}</span>
    </div>
  )

  return href ? <Link href={href}>{inner}</Link> : inner
}
