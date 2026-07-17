import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getCachedDashboardData, getCachedTradeStatusByLotIds } from '@/lib/data'
import Greeting from './Greeting'
import FortnightCalendar, { type CalendarItem, type DashboardCalendarEvent } from './FortnightCalendar'
import ExtraJobsList, { type ExtraJobItem } from './ExtraJobsList'
import PreStartsWeek, { type PreStartDay } from './PreStartsWeek'
import QuickAddExtraJobModal from './QuickAddExtraJobModal'
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
  const isSupervisor  = ['supervisor', 'admin'].includes(profile.role)
  const isAdmin       = profile.role === 'admin'

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let extraJobs: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let preStarts: any[] = []
  let vehicleAlertCount = 0
  let incidentCount = 0
  let overdueLotCount = 0
  let pendingReviewCount = 0
  let approvedForInvoicingCount = 0
  let sitesForModal: Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }> = []
  let calendarEventItems: DashboardCalendarEvent[] = []

  // All roles: fortnight lots + trade status
  try {
    const { lotsData: ld } = await getCachedDashboardData(fortnightStr)
    lotsData = ld
    tradeStatus = await getCachedTradeStatusByLotIds(lotsData.map((l: { id: string }) => l.id))
  } catch {
    // graceful fallback
  }

  // All roles: overdue lots count + extra jobs
  try {
    const supabase = await createClient()

    const { count } = await supabase
      .from('lots')
      .select('id', { count: 'exact', head: true })
      .lt('due_date', todayStr)
      .neq('status', 'complete')
    overdueLotCount = count ?? 0

    const { data: ejData } = await supabase
      .from('extra_jobs')
      .select('id, title, status, due_date, stages!inner(id, name, sites!inner(id, name))')
      .neq('status', 'complete')
      .order('due_date', { ascending: true, nullsFirst: false })
    extraJobs = ejData ?? []
  } catch {
    // graceful fallback
  }

  // Admin: pending review + approved for invoicing counts
  if (isAdmin) {
    try {
      const supabase = await createClient()
      const [{ count: pCount }, { count: aCount }] = await Promise.all([
        supabase.from('lots').select('id', { count: 'exact', head: true }).eq('pending_review', true),
        supabase.from('lots').select('id', { count: 'exact', head: true }).eq('approved_for_invoicing', true),
      ])
      pendingReviewCount = pCount ?? 0
      approvedForInvoicingCount = aCount ?? 0
    } catch {
      // columns may not exist yet
    }
  }

  // Leading hand+: recent incidents
  if (isLeadingHand) {
    try {
      const supabase = await createClient()
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { data } = await supabase
        .from('incidents')
        .select('id')
        .gte('date', toYmd(weekAgo))
      incidentCount = (data ?? []).length
    } catch {
      // table may not exist
    }
  }

  // All roles: sites+stages for quick-add extra job modal
  try {
    const supabase = await createClient()
    const { data: sitesRaw } = await supabase
      .from('sites')
      .select('id, name, stages(id, name, order)')
      .is('completed_at', null)
      .order('name', { ascending: true })
    sitesForModal = (sitesRaw ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stages: [...((s.stages as any[]) ?? [])]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((st: { id: string; name: string }) => ({ id: st.id, name: st.name })),
    }))
  } catch {
    // graceful fallback — modal button won't show
  }

  // All roles: calendar events for fortnight window
  try {
    const supabase = await createClient()
    const { data: evRaw } = await supabase
      .from('calendar_events')
      .select('id, title, event_date, end_date, start_time')
      .lte('event_date', fortnightStr)
      .order('event_date', { ascending: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    calendarEventItems = (evRaw ?? []).map((e: any) => ({
      id: e.id,
      title: e.title,
      eventDate: e.event_date,
      endDate: e.end_date ?? null,
      startTime: e.start_time ?? null,
    }))
  } catch {
    // table not yet created
  }

  // Supervisor+: pre-starts this week + vehicle alerts
  if (isSupervisor) {
    const supabase = await createClient()

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

  const showVehicleAlert = isSupervisor && vehicleAlertCount > 0
  const showIncidents    = isLeadingHand && incidentCount > 0

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">

        <div className="flex items-start justify-between gap-3">
          <Greeting name={profile.first_name} />
          {sitesForModal.length > 0 && (
            <div className="hidden sm:block shrink-0 pt-1">
              <QuickAddExtraJobModal sites={sitesForModal} />
            </div>
          )}
        </div>

        {/* Section 1 — Summary cards (all roles) */}
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
            label="Overdue lots"
            value={overdueLotCount}
            color={overdueLotCount > 0 ? 'red' : 'green'}
            href="/schedule"
          />
        </div>

        {/* Section 1b — Invoicing cards (admin only) */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Pending review"
              value={pendingReviewCount}
              color={pendingReviewCount > 0 ? 'amber' : 'green'}
              href="/invoices"
            />
            <MetricCard
              label="Approved for invoicing"
              value={approvedForInvoicingCount}
              color={approvedForInvoicingCount > 0 ? 'blue' : 'green'}
              href="/invoices"
            />
          </div>
        )}

        {/* Section 2 — Fortnight calendar (all roles) */}
        <section>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">Next 2 weeks</h2>
          <FortnightCalendar items={calendarItems} events={calendarEventItems} />
        </section>

        {/* Section 3 — Extra jobs to complete (all roles, hidden if empty) */}
        <ExtraJobsList jobs={extraJobItems} />

        {/* Section 4 — Pre-starts this week (supervisor+) */}
        {isSupervisor && preStartDays.length > 0 && (
          <PreStartsWeek days={preStartDays} />
        )}

        {/* Section 5 — Needs attention: vehicle alerts (supervisor+), incidents (leading_hand+) */}
        {(showVehicleAlert || showIncidents) && (
          <section>
            <h2 className="text-base font-semibold text-fg-secondary mb-3">Needs attention</h2>
            <div className="grid grid-cols-2 gap-3">
              {showVehicleAlert && (
                <Link href="/vehicles" className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{vehicleAlertCount}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Rego / service due in 7 days</p>
                </Link>
              )}
              {showIncidents && (
                <Link href="/safety" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                  <p className="text-xl font-bold text-red-700 dark:text-red-400">{incidentCount}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">Incident{incidentCount !== 1 ? 's' : ''} in last 7 days</p>
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
    blue:  'text-blue-700 dark:text-blue-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red:   'text-red-700 dark:text-red-400',
    green: 'text-accent-fg',
  }

  const inner = (
    <div className={`rounded-xl border border-border bg-surface px-3 py-3.5 flex flex-col gap-1${href ? ' hover:bg-surface-raised transition-colors' : ''}`}>
      <span className={`text-2xl font-bold ${colors[color]}`}>
        {value.toLocaleString('en-AU')}
      </span>
      <span className="text-xs text-fg-muted leading-tight">{label}</span>
    </div>
  )

  return href ? <Link href={href}>{inner}</Link> : inner
}
