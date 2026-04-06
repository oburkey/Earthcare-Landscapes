import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { STATUS_CONFIG, EXTRA_JOB_STATUS_CONFIG } from '@/lib/lotStatus'
import Link from 'next/link'
import type { LotStatus, ExtraJobStatus } from '@/types/database'

export const metadata = { title: 'Schedule — Earthcare Landscapes' }

function getWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday as week start
  date.setDate(date.getDate() + diff)
  return date.toISOString().split('T')[0]
}

function formatWeekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const endOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', endOpts)}`
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

type ScheduleItem =
  | {
      kind: 'lot'
      id: string
      siteId: string
      stageId: string
      lotId: string
      label: string
      site: string
      stage: string
      status: LotStatus
      due_date: string
    }
  | {
      kind: 'job'
      id: string
      siteId: string
      stageId: string
      label: string
      site: string
      stage: string
      status: ExtraJobStatus
      due_date: string
    }

export default async function SchedulePage() {
  await requireAuth()

  const supabase = await createClient()

  const { data: lots } = await supabase
    .from('lots')
    .select(`
      id, lot_number, status, due_date,
      stages!inner(
        id, name,
        sites!inner(id, name)
      )
    `)
    .not('due_date', 'is', null)
    .neq('status', 'complete')
    .order('due_date', { ascending: true })

  const { data: jobs } = await supabase
    .from('extra_jobs')
    .select(`
      id, title, status, due_date,
      stages!inner(
        id, name,
        sites!inner(id, name)
      )
    `)
    .not('due_date', 'is', null)
    .neq('status', 'complete')
    .order('due_date', { ascending: true })

  const items: ScheduleItem[] = []

  for (const lot of lots ?? []) {
    const stage = Array.isArray(lot.stages) ? lot.stages[0] : lot.stages as { id: string; name: string; sites: unknown }
    const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }
    items.push({
      kind: 'lot',
      id: lot.id,
      siteId: site.id,
      stageId: stage.id,
      lotId: lot.id,
      label: `Lot ${lot.lot_number}`,
      site: site.name,
      stage: stage.name,
      status: lot.status as LotStatus,
      due_date: lot.due_date as string,
    })
  }

  for (const job of jobs ?? []) {
    const stage = Array.isArray(job.stages) ? job.stages[0] : job.stages as { id: string; name: string; sites: unknown }
    const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }
    items.push({
      kind: 'job',
      id: job.id,
      siteId: site.id,
      stageId: stage.id,
      label: job.title,
      site: site.name,
      stage: stage.name,
      status: job.status as ExtraJobStatus,
      due_date: job.due_date as string,
    })
  }

  // Sort all items by due date
  items.sort((a, b) => a.due_date.localeCompare(b.due_date))

  // Group by week
  const weeks = new Map<string, ScheduleItem[]>()
  for (const item of items) {
    const week = getWeekStart(item.due_date)
    if (!weeks.has(week)) weeks.set(week, [])
    weeks.get(week)!.push(item)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        <h1 className="text-xl font-semibold text-stone-900">Schedule</h1>

        {items.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-12 text-center">
            <p className="text-sm text-stone-500">No upcoming work with due dates.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {[...weeks.entries()].map(([weekStart, weekItems]) => {
              const isOverdue = weekStart < today
              return (
                <div key={weekStart}>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-semibold text-stone-600">
                      {formatWeekLabel(weekStart)}
                    </h2>
                    {isOverdue && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Overdue
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-white overflow-hidden divide-y divide-stone-100">
                    {weekItems.map((item) => {
                      const href =
                        item.kind === 'lot'
                          ? `/sites/${item.siteId}/stages/${item.stageId}/lots/${item.lotId}`
                          : `/sites/${item.siteId}/stages/${item.stageId}/extra-jobs/${item.id}`

                      const cfg =
                        item.kind === 'lot'
                          ? (STATUS_CONFIG[item.status] ?? STATUS_CONFIG.not_started)
                          : (EXTRA_JOB_STATUS_CONFIG[item.status as ExtraJobStatus] ?? EXTRA_JOB_STATUS_CONFIG.not_started)

                      return (
                        <Link
                          key={item.id}
                          href={href}
                          className="flex items-start gap-3 px-4 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-stone-900">{item.label}</span>
                              {item.kind === 'job' && (
                                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                  Extra job
                                </span>
                              )}
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {item.site} · {item.stage}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-stone-500">{formatDate(item.due_date)}</p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
