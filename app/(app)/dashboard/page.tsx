import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getCachedDashboardData } from '@/lib/data'
import Greeting from './Greeting'

export const metadata = { title: 'Dashboard — Earthcare Landscapes' }

// ── Types ─────────────────────────────────────────────────────────────────────

type UpcomingLot = {
  id: string
  lot_number: string
  due_date: string
  stages: {
    id: string
    name: string
    sites: {
      id: string
      name: string
    }
  }
}

type SiteRow = {
  id: string
  name: string
  stages: {
    lots: {
      id: string
      status: string
    }[]
  }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysUntilDue(dueDateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function deadlineStyle(days: number) {
  if (days < 0)
    return {
      row: 'bg-red-50 border-red-200',
      badge: 'bg-red-600 text-white',
      label: 'Overdue',
      dot: 'bg-red-600',
    }
  if (days <= 3)
    return {
      row: 'bg-red-50 border-red-200',
      badge: 'bg-red-500 text-white',
      label: days === 0 ? 'Today' : `${days}d`,
      dot: 'bg-red-500',
    }
  if (days <= 8)
    return {
      row: 'bg-amber-50 border-amber-200',
      badge: 'bg-amber-500 text-white',
      label: `${days}d`,
      dot: 'bg-amber-500',
    }
  return {
    row: 'bg-green-50 border-green-200',
    badge: 'bg-green-600 text-white',
    label: `${days}d`,
    dot: 'bg-green-600',
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const profile = await requireAuth()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const fortnight = new Date(today)
  fortnight.setDate(fortnight.getDate() + 14)
  const fortnightStr = fortnight.toISOString().split('T')[0]

  // ── Fetch upcoming & overdue lots (cached) ─────────────────────────────────
  let upcomingLots: UpcomingLot[] = []
  let sitesData: SiteRow[] = []

  try {
    const { lotsData, sitesData: sites } = await getCachedDashboardData(fortnightStr)
    upcomingLots = lotsData as unknown as UpcomingLot[]
    sitesData = sites as unknown as SiteRow[]
  } catch {
    // Supabase not configured or service key missing — renders with empty data
  }

  // ── Derive metrics ────────────────────────────────────────────────────────
  const overdueLots = upcomingLots.filter(
    (l) => getDaysUntilDue(l.due_date) < 0
  )
  const dueFortnight = upcomingLots.filter(
    (l) => getDaysUntilDue(l.due_date) >= 0
  )

  // Active sites = sites with at least one non-complete lot
  const siteProgress = sitesData.map((site) => {
    const allLots = site.stages.flatMap((s) => s.lots)
    const total = allLots.length
    const completed = allLots.filter((l) => l.status === 'complete').length
    return { id: site.id, name: site.name, total, completed }
  })

  const activeSites = siteProgress.filter((s) => s.completed < s.total)

  // ── Group upcoming lots by site → stage ───────────────────────────────────
  type StageGroup = {
    stageId: string
    stageName: string
    lots: (UpcomingLot & { days: number })[]
  }
  type SiteGroup = {
    siteId: string
    siteName: string
    stages: StageGroup[]
  }

  const groupMap = new Map<string, SiteGroup>()

  for (const lot of upcomingLots) {
    const { id: siteId, name: siteName } = lot.stages.sites
    const { id: stageId, name: stageName } = lot.stages
    const days = getDaysUntilDue(lot.due_date)

    if (!groupMap.has(siteId)) {
      groupMap.set(siteId, { siteId, siteName, stages: [] })
    }
    const siteGroup = groupMap.get(siteId)!

    let stageGroup = siteGroup.stages.find((s) => s.stageId === stageId)
    if (!stageGroup) {
      stageGroup = { stageId, stageName, lots: [] }
      siteGroup.stages.push(stageGroup)
    }
    stageGroup.lots.push({ ...lot, days })
  }

  const deadlineGroups = Array.from(groupMap.values())

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">

        {/* Greeting */}
        <Greeting name={profile.full_name} />

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Active sites"
            value={activeSites.length}
            color="blue"
          />
          <MetricCard
            label="Due this fortnight"
            value={dueFortnight.length}
            color="amber"
            href="/schedule"
          />
          <MetricCard
            label="Overdue"
            value={overdueLots.length}
            color={overdueLots.length > 0 ? 'red' : 'green'}
            href="/schedule"
          />
        </div>

        {/* Upcoming deadlines */}
        <section>
          <h2 className="text-base font-semibold text-stone-800 mb-3">
            Upcoming deadlines
          </h2>

          {deadlineGroups.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center">
              <p className="text-sm text-stone-500">
                No lots due in the next two weeks.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deadlineGroups.map((site) => (
                <div
                  key={site.siteId}
                  className="rounded-xl border border-stone-200 bg-white overflow-hidden"
                >
                  {/* Site header */}
                  <div className="px-4 py-2.5 bg-stone-100 border-b border-stone-200">
                    <span className="text-sm font-semibold text-stone-800">
                      {site.siteName}
                    </span>
                  </div>

                  {/* Stages */}
                  {site.stages.map((stage) => (
                    <div key={stage.stageId} className="px-4 py-3 border-b border-stone-100 last:border-b-0">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                        {stage.stageName} — {stage.lots.length} lot{stage.lots.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {stage.lots.map((lot) => {
                          const style = deadlineStyle(lot.days)
                          return (
                            <Link
                              key={lot.id}
                              href={`/sites/${lot.stages.sites.id}/stages/${lot.stages.id}/lots/${lot.id}`}
                              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${style.row} hover:opacity-75 transition-opacity`}
                            >
                              <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
                              <span className="text-sm font-medium text-stone-800">
                                Lot {lot.lot_number}
                              </span>
                              <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${style.badge}`}>
                                {style.label}
                              </span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active sites */}
        <section>
          <h2 className="text-base font-semibold text-stone-800 mb-3">
            Active sites
          </h2>

          {activeSites.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center">
              <p className="text-sm text-stone-500">No active sites.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
              {activeSites.map((site) => {
                const pct = site.total > 0
                  ? Math.round((site.completed / site.total) * 100)
                  : 0
                return (
                  <Link key={site.id} href={`/sites/${site.id}`} className="block px-4 py-3.5 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-stone-900">
                        {site.name}
                      </span>
                      <span className="text-xs text-stone-500">
                        {site.completed} / {site.total} lots complete
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-stone-100">
                      <div
                        className="h-2 rounded-full bg-green-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}

// ── Metric card component ─────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  color,
  href,
}: {
  label: string
  value: number
  color: 'blue' | 'amber' | 'red' | 'green'
  href?: string
}) {
  const colors = {
    blue:  'text-blue-700 bg-blue-50',
    amber: 'text-amber-700 bg-amber-50',
    red:   'text-red-700 bg-red-50',
    green: 'text-green-700 bg-green-50',
  }

  const inner = (
    <div className={`rounded-xl border border-stone-200 bg-white px-3 py-3.5 flex flex-col gap-1${href ? ' hover:bg-stone-50 transition-colors' : ''}`}>
      <span className={`text-2xl font-bold ${colors[color].split(' ')[0]}`}>
        {value}
      </span>
      <span className="text-xs text-stone-500 leading-tight">{label}</span>
    </div>
  )

  return href ? <Link href={href}>{inner}</Link> : inner
}
