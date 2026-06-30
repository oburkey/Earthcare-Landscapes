'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  STATUS_CONFIG,
  EXTRA_JOB_STATUS_CONFIG,
  TRADE_OPTIONS,
  formatDate,
} from '@/lib/lotStatus'
import type { LotStatus, ExtraJobStatus } from '@/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LotItem = {
  id: string
  siteId: string
  siteName: string
  stageId: string
  stageName: string
  lotId: string
  lotNumber: string
  status: LotStatus
  dueDate: string
  tradesCompleted: string[]
  readyForLandscaping: boolean
}

export type JobItem = {
  id: string
  siteId: string
  siteName: string
  stageId: string
  stageName: string
  title: string
  status: ExtraJobStatus
  dueDate: string
}

export type SiteOption = { id: string; name: string }

type View = 'week' | 'month' | 'list'

// ── Date helpers ──────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function ymd(year: number, month: number, day: number): string {
  const date = new Date(year, month, day)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  return ymd(date.getFullYear(), date.getMonth(), date.getDate())
}

function getWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday as week start
  date.setDate(date.getDate() + diff)
  return ymd(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatWeekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const endOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', endOpts)}`
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

// Returns an array of date strings (full weeks, Mon-Sun) covering the given month
function getMonthGrid(year: number, month: number): string[] {
  const firstOfMonth = ymd(year, month, 1)
  const lastOfMonth = ymd(year, month + 1, 0)
  const gridStart = getWeekStart(firstOfMonth)
  const gridEnd = addDays(getWeekStart(lastOfMonth), 6)

  const days: string[] = []
  let cur = gridStart
  while (cur <= gridEnd) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  return days
}

// ── Small components ─────────────────────────────────────────────────────────

function TradeChips({ tradesCompleted }: { tradesCompleted: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {TRADE_OPTIONS.map((trade) => {
        const done = tradesCompleted.includes(trade)
        return (
          <span
            key={trade}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              done ? 'bg-green-700 text-white' : 'border border-border text-fg-muted'
            }`}
          >
            {trade}
          </span>
        )
      })}
    </div>
  )
}

function LotCard({ item, today }: { item: LotItem; today: string }) {
  const overdueBlocked = item.dueDate < today && !item.readyForLandscaping
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.not_started

  return (
    <Link
      href={`/sites/${item.siteId}/stages/${item.stageId}/lots/${item.lotId}`}
      className={`block rounded-xl border bg-surface p-3 hover:bg-surface-raised transition-colors ${
        overdueBlocked ? 'border-red-300 ring-1 ring-red-200' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <span className="text-sm font-semibold text-fg">Lot {item.lotNumber}</span>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              item.readyForLandscaping ? 'bg-accent-dim text-accent-fg' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {item.readyForLandscaping ? 'Ready' : 'Blocked'}
          </span>
        </div>
      </div>
      <p className="text-xs text-fg-muted mb-2">{item.siteName} · {item.stageName}</p>
      <TradeChips tradesCompleted={item.tradesCompleted} />
      {overdueBlocked && (
        <p className="mt-2 text-xs font-semibold text-red-600">Overdue and blocked — needs urgent attention</p>
      )}
    </Link>
  )
}

function JobPill({ item }: { item: JobItem }) {
  const cfg = EXTRA_JOB_STATUS_CONFIG[item.status] ?? EXTRA_JOB_STATUS_CONFIG.not_started
  return (
    <Link
      href={`/sites/${item.siteId}/stages/${item.stageId}/extra-jobs/${item.id}`}
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-surface-raised transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 shrink-0">Extra job</span>
        <span className="text-sm text-fg-secondary truncate">{item.title}</span>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${cfg.badge}`}>{cfg.label}</span>
    </Link>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
      <p className="text-sm text-fg-muted">{text}</p>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  lots, jobs, today, weekOffset, onWeekOffsetChange,
}: {
  lots: LotItem[]
  jobs: JobItem[]
  today: string
  weekOffset: number
  onWeekOffsetChange: (next: number) => void
}) {
  const weekStart = addDays(getWeekStart(today), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => onWeekOffsetChange(weekOffset - 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-raised transition-colors">
          ‹ Prev
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-fg-secondary">{formatWeekLabel(weekStart)}</h2>
          {weekOffset !== 0 && (
            <button type="button" onClick={() => onWeekOffsetChange(0)}
              className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">
              Back to this week
            </button>
          )}
        </div>
        <button type="button" onClick={() => onWeekOffsetChange(weekOffset + 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-raised transition-colors">
          Next ›
        </button>
      </div>

      <div className="space-y-3">
        {days.map((day) => {
          const dayLots = lots.filter((l) => l.dueDate === day)
          const dayJobs = jobs.filter((j) => j.dueDate === day)
          const isToday = day === today
          const isOverdue = day < today

          return (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className={`text-sm font-semibold ${isToday ? 'text-accent-fg' : 'text-fg-muted'}`}>
                  {formatDayLabel(day)}
                </h3>
                {isToday && (
                  <span className="rounded-full bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent-fg">Today</span>
                )}
                {isOverdue && (dayLots.length > 0 || dayJobs.length > 0) && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>
                )}
              </div>
              {dayLots.length === 0 && dayJobs.length === 0 ? (
                <p className="text-xs text-fg-muted px-1">Nothing due</p>
              ) : (
                <div className="space-y-2">
                  {dayLots.map((item) => <LotCard key={item.id} item={item} today={today} />)}
                  {dayJobs.map((item) => <JobPill key={item.id} item={item} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  lots, jobs, today, monthCursor, onMonthCursorChange, selectedDay, onSelectedDayChange,
}: {
  lots: LotItem[]
  jobs: JobItem[]
  today: string
  monthCursor: { year: number; month: number }
  onMonthCursorChange: (next: { year: number; month: number }) => void
  selectedDay: string | null
  onSelectedDayChange: (day: string | null) => void
}) {
  const { year, month } = monthCursor
  const days = getMonthGrid(year, month)

  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    onMonthCursorChange({ year: y, month: m })
    onSelectedDayChange(null)
  }

  function backToThisMonth() {
    const now = new Date()
    onMonthCursorChange({ year: now.getFullYear(), month: now.getMonth() })
    onSelectedDayChange(null)
  }

  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth()

  const selectedLots = selectedDay ? lots.filter((l) => l.dueDate === selectedDay) : []
  const selectedJobs = selectedDay ? jobs.filter((j) => j.dueDate === selectedDay) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => changeMonth(-1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-raised transition-colors">
          ‹ Prev
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-fg-secondary">{monthLabel(year, month)}</h2>
          {!isCurrentMonth && (
            <button type="button" onClick={backToThisMonth}
              className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">
              Back to this month
            </button>
          )}
        </div>
        <button type="button" onClick={() => changeMonth(1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-raised transition-colors">
          Next ›
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-raised">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="px-1 py-1.5 text-center text-xs font-medium text-fg-muted">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const [, m] = day.split('-').map(Number)
            const inMonth = (m - 1) === month
            const dayLots = lots.filter((l) => l.dueDate === day)
            const isToday = day === today
            const isSelected = day === selectedDay
            const dotColor = dayLots.length === 0
              ? null
              : dayLots.every((l) => l.readyForLandscaping) ? 'bg-accent-dim0' : 'bg-amber-500'
            const dayNum = Number(day.split('-')[2])
            const visibleLots = dayLots.slice(0, 3)
            const extraCount = dayLots.length - visibleLots.length

            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectedDayChange(isSelected ? null : day)}
                className={`flex min-h-28 flex-col items-stretch gap-1 border-b border-r border-border-subtle p-1.5 text-left transition-colors hover:bg-surface-raised ${
                  isSelected ? 'bg-accent-dim' : inMonth ? '' : 'bg-surface-raised/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? 'bg-green-700 text-white font-semibold' : inMonth ? 'text-fg-secondary' : 'text-fg-muted'
                  }`}>
                    {dayNum}
                  </span>
                  {dotColor && <span className={`h-3 w-3 rounded-full ${dotColor}`} />}
                </div>
                <div className="flex flex-col gap-1">
                  {visibleLots.map((item) => (
                    <span
                      key={item.id}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        item.readyForLandscaping ? 'bg-accent-dim text-accent-fg' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      Lot {item.lotNumber}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span className="text-[11px] text-fg-muted">+{extraCount} more</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-fg-secondary">{formatDate(selectedDay)}</h3>
          {selectedLots.length === 0 && selectedJobs.length === 0 ? (
            <p className="text-xs text-fg-muted px-1">Nothing due</p>
          ) : (
            <div className="space-y-2">
              {selectedLots.map((item) => <LotCard key={item.id} item={item} today={today} />)}
              {selectedJobs.map((item) => <JobPill key={item.id} item={item} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── List view (original behaviour) ───────────────────────────────────────────

type FlatItem =
  | { kind: 'lot'; id: string; siteId: string; stageId: string; lotId: string; label: string; site: string; stage: string; status: LotStatus; due_date: string; tradesCompleted: string[]; readyForLandscaping: boolean }
  | { kind: 'job'; id: string; siteId: string; stageId: string; label: string; site: string; stage: string; status: ExtraJobStatus; due_date: string }

function ListView({ lots, jobs, today }: { lots: LotItem[]; jobs: JobItem[]; today: string }) {
  const items: FlatItem[] = [
    ...lots.map((l): FlatItem => ({
      kind: 'lot', id: l.id, siteId: l.siteId, stageId: l.stageId, lotId: l.lotId,
      label: `Lot ${l.lotNumber}`, site: l.siteName, stage: l.stageName, status: l.status, due_date: l.dueDate,
      tradesCompleted: l.tradesCompleted, readyForLandscaping: l.readyForLandscaping,
    })),
    ...jobs.map((j): FlatItem => ({
      kind: 'job', id: j.id, siteId: j.siteId, stageId: j.stageId,
      label: j.title, site: j.siteName, stage: j.stageName, status: j.status, due_date: j.dueDate,
    })),
  ]
  items.sort((a, b) => a.due_date.localeCompare(b.due_date))

  const weeks = new Map<string, FlatItem[]>()
  for (const item of items) {
    const week = getWeekStart(item.due_date)
    if (!weeks.has(week)) weeks.set(week, [])
    weeks.get(week)!.push(item)
  }

  if (items.length === 0) {
    return <EmptyState text="No upcoming work with due dates." />
  }

  return (
    <div className="space-y-5">
      {[...weeks.entries()].map(([weekStart, weekItems]) => {
        const isOverdue = weekStart < today
        return (
          <div key={weekStart}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-fg-secondary">{formatWeekLabel(weekStart)}</h2>
              {isOverdue && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
              {weekItems.map((item) => {
                const href = item.kind === 'lot'
                  ? `/sites/${item.siteId}/stages/${item.stageId}/lots/${item.lotId}`
                  : `/sites/${item.siteId}/stages/${item.stageId}/extra-jobs/${item.id}`

                const cfg = item.kind === 'lot'
                  ? (STATUS_CONFIG[item.status] ?? STATUS_CONFIG.not_started)
                  : (EXTRA_JOB_STATUS_CONFIG[item.status as ExtraJobStatus] ?? EXTRA_JOB_STATUS_CONFIG.not_started)

                return (
                  <Link key={item.id} href={href}
                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-raised active:bg-surface-raised transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-fg">{item.label}</span>
                        {item.kind === 'job' && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Extra job</span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                        {item.kind === 'lot' && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.readyForLandscaping ? 'bg-accent-dim text-accent-fg' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.readyForLandscaping ? 'Ready' : 'Blocked'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-fg-muted">{item.site} · {item.stage}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-fg-muted">{formatDate(item.due_date)}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Blocked lots (triage) view ───────────────────────────────────────────────

function BlockedView({ lots, today }: { lots: LotItem[]; today: string }) {
  const blocked = [...lots]
    .filter((l) => !l.readyForLandscaping)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  if (blocked.length === 0) {
    return <EmptyState text="No blocked lots — everything is ready for landscaping." />
  }

  return (
    <div className="space-y-2">
      {blocked.map((item) => (
        <div key={item.id}>
          <p className="text-xs text-fg-muted mb-1">
            Due {formatDate(item.dueDate)}{item.dueDate < today ? ' · Overdue' : ''}
          </p>
          <LotCard item={item} today={today} />
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  lotItems: LotItem[]
  jobItems: JobItem[]
  sites: SiteOption[]
  today: string
}

export default function ScheduleView({ lotItems, jobItems, sites, today }: Props) {
  const [view, setView] = useState<View>('week')
  const [siteFilter, setSiteFilter] = useState('')
  const [showBlocked, setShowBlocked] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthCursor, setMonthCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, month: m - 1 }
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const lots = siteFilter ? lotItems.filter((l) => l.siteId === siteFilter) : lotItems
  const jobs = siteFilter ? jobItems.filter((j) => j.siteId === siteFilter) : jobItems

  const views: Array<{ id: View; label: string }> = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'list', label: 'List' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => { setView(v.id); setShowBlocked(false) }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                !showBlocked && view === v.id
                  ? 'bg-stone-900 text-white'
                  : 'text-fg-muted hover:bg-surface-raised'
              }`}
            >
              {v.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowBlocked((b) => !b)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              showBlocked
                ? 'bg-amber-600 text-white'
                : 'text-fg-muted hover:bg-surface-raised'
            }`}
          >
            Blocked lots
          </button>
        </div>

        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-border focus:outline-none">
          <option value="">All sites</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {showBlocked ? (
        <BlockedView lots={lots} today={today} />
      ) : view === 'week' ? (
        <WeekView lots={lots} jobs={jobs} today={today} weekOffset={weekOffset} onWeekOffsetChange={setWeekOffset} />
      ) : view === 'month' ? (
        <MonthView
          lots={lots} jobs={jobs} today={today}
          monthCursor={monthCursor} onMonthCursorChange={setMonthCursor}
          selectedDay={selectedDay} onSelectedDayChange={setSelectedDay}
        />
      ) : (
        <ListView lots={lots} jobs={jobs} today={today} />
      )}
    </div>
  )
}
