'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  STATUS_CONFIG,
  EXTRA_JOB_STATUS_CONFIG,
  TRADE_OPTIONS,
  formatDate,
  siteColour,
} from '@/lib/lotStatus'
import type { LotStatus, ExtraJobStatus } from '@/types/database'
import EventDayPanel from './EventDayPanel'

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

export type CalendarEvent = {
  id: string
  title: string
  description: string | null
  eventDate: string
  endDate: string | null
  startTime: string | null
  endTime: string | null
  createdBy: string | null
  createdByName: string | null
}

export type SiteOption = { id: string; name: string }

type View = '2weeks' | 'month' | 'list'

const VALID_VIEWS: View[] = ['2weeks', 'month', 'list']

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
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return ymd(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatWeekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end   = new Date(y, m - 1, d + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const endOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', endOpts)}`
}

function format2WeekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end   = new Date(y, m - 1, d + 11) // second Friday
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const endOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${start.toLocaleDateString('en-AU', opts)} – ${end.toLocaleDateString('en-AU', endOpts)}`
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

function getMonthGrid(year: number, month: number): string[] {
  const firstOfMonth = ymd(year, month, 1)
  const lastOfMonth  = ymd(year, month + 1, 0)
  const gridStart    = getWeekStart(firstOfMonth)
  const gridEnd      = addDays(getWeekStart(lastOfMonth), 6)
  const days: string[] = []
  let cur = gridStart
  while (cur <= gridEnd) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  return days
}

// ── Event helpers ─────────────────────────────────────────────────────────────

function getEventsForDay(events: CalendarEvent[], day: string): CalendarEvent[] {
  return events.filter((e) => e.eventDate <= day && (e.endDate === null || e.endDate >= day))
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
}

// ── Shared small components ───────────────────────────────────────────────────

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
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            item.readyForLandscaping ? 'bg-accent-dim text-accent-fg' : 'bg-amber-100 text-amber-700'
          }`}>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
      <p className="text-sm text-fg-muted">{text}</p>
    </div>
  )
}

// ── 2-week view ───────────────────────────────────────────────────────────────

function TwoWeekLotChip({ item, today }: { item: LotItem; today: string }) {
  const sc  = siteColour(item.siteName)
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.not_started
  const overdueBlocked = item.dueDate < today && !item.readyForLandscaping
  return (
    <Link
      href={`/sites/${item.siteId}/stages/${item.stageId}/lots/${item.lotId}`}
      className={`block rounded-lg border p-1.5 hover:bg-surface-raised transition-colors ${
        overdueBlocked
          ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center gap-1 flex-wrap mb-0.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${sc.badge}`}>{sc.abbr}</span>
        <span className="text-xs font-semibold text-fg leading-tight">Lot {item.lotNumber}</span>
      </div>
      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
    </Link>
  )
}

function TwoWeekJobChip({ item }: { item: JobItem }) {
  const cfg = EXTRA_JOB_STATUS_CONFIG[item.status] ?? EXTRA_JOB_STATUS_CONFIG.not_started
  return (
    <Link
      href={`/sites/${item.siteId}/stages/${item.stageId}/extra-jobs/${item.id}`}
      className="block rounded-lg border border-border bg-surface p-1.5 hover:bg-surface-raised transition-colors"
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 shrink-0">XJ</span>
        <span className="text-[10px] font-medium text-fg-secondary truncate leading-tight">{item.title}</span>
      </div>
      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
    </Link>
  )
}

function TwoWeekEventChip({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen() }}
      className="block w-full rounded-lg border border-green-500/70 bg-surface p-1.5 text-left hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
    >
      {event.startTime && (
        <span className="text-[9px] text-fg-muted">{formatTime(event.startTime)} </span>
      )}
      <span className="text-[10px] font-medium text-green-700 dark:text-green-400 truncate block leading-tight">
        {event.title}
      </span>
    </button>
  )
}

function WeekGrid({ days, lots, jobs, events, today, onDayClick }: {
  days: string[]
  lots: LotItem[]
  jobs: JobItem[]
  events: CalendarEvent[]
  today: string
  onDayClick: (day: string) => void
}) {
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Clickable day headers */}
      <div className="grid grid-cols-5 border-b border-border-subtle bg-surface-raised">
        {days.map((day) => {
          const [y, m, d] = day.split('-').map(Number)
          const date    = new Date(y, m - 1, d)
          const weekday = date.toLocaleDateString('en-AU', { weekday: 'short' })
          const isToday = day === today
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick(day)}
              className={`px-2 py-2 text-center border-r last:border-r-0 border-border-subtle hover:bg-surface transition-colors ${
                isToday ? 'bg-accent-dim' : ''
              }`}
            >
              <div className={`text-[11px] font-medium uppercase tracking-wide ${isToday ? 'text-accent-fg' : 'text-fg-muted'}`}>
                {weekday}
              </div>
              <div className={`text-base font-semibold mt-0.5 ${isToday ? 'text-accent-fg' : 'text-fg-secondary'}`}>
                {d}
              </div>
            </button>
          )
        })}
      </div>

      {/* Content columns with 12pm reference line */}
      <div className="relative grid grid-cols-5 min-h-56">
        <div
          className="absolute inset-x-0 top-1/2 border-t border-dashed border-border pointer-events-none z-10"
          aria-hidden="true"
        >
          <span className="absolute left-2 -top-3 text-[9px] font-medium text-fg-muted select-none">12pm</span>
        </div>

        {days.map((day) => {
          const dayLots   = lots.filter((l) => l.dueDate === day)
          const dayJobs   = jobs.filter((j) => j.dueDate === day)
          const dayEvents = getEventsForDay(events, day)
          const isToday   = day === today
          return (
            <div
              key={day}
              className={`p-1.5 border-r last:border-r-0 border-border-subtle space-y-1.5 ${
                isToday ? 'bg-green-50/40 dark:bg-green-900/5' : ''
              }`}
            >
              {dayLots.map((item) => (
                <TwoWeekLotChip key={item.id} item={item} today={today} />
              ))}
              {dayJobs.map((item) => (
                <TwoWeekJobChip key={item.id} item={item} />
              ))}
              {dayEvents.map((ev) => (
                <TwoWeekEventChip key={ev.id} event={ev} onOpen={() => onDayClick(day)} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TwoWeekView({
  lots, jobs, events, today, offset, onOffsetChange, onDayClick,
}: {
  lots: LotItem[]
  jobs: JobItem[]
  events: CalendarEvent[]
  today: string
  offset: number
  onOffsetChange: (next: number) => void
  onDayClick: (day: string) => void
}) {
  const weekStart  = addDays(getWeekStart(today), offset * 14)
  const week2Start = addDays(weekStart, 7)
  const week1Days  = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))
  const week2Days  = Array.from({ length: 5 }, (_, i) => addDays(week2Start, i))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onOffsetChange(offset - 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-raised transition-colors"
        >
          ‹ Prev
        </button>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-fg-secondary">{format2WeekLabel(weekStart)}</h2>
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => onOffsetChange(0)}
              className="text-xs text-fg-muted hover:text-fg-secondary transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOffsetChange(offset + 1)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-raised transition-colors"
        >
          Next ›
        </button>
      </div>

      <WeekGrid days={week1Days} lots={lots} jobs={jobs} events={events} today={today} onDayClick={onDayClick} />
      <WeekGrid days={week2Days} lots={lots} jobs={jobs} events={events} today={today} onDayClick={onDayClick} />
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────

function MonthView({
  lots, events, today, monthCursor, onMonthCursorChange, selectedDay, onDayClick,
}: {
  lots: LotItem[]
  events: CalendarEvent[]
  today: string
  monthCursor: { year: number; month: number }
  onMonthCursorChange: (next: { year: number; month: number }) => void
  selectedDay: string | null
  onDayClick: (day: string) => void
}) {
  const { year, month } = monthCursor
  const days = getMonthGrid(year, month)

  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0)  { m = 11; y -= 1 }
    if (m > 11) { m = 0;  y += 1 }
    onMonthCursorChange({ year: y, month: m })
  }

  function backToThisMonth() {
    const now = new Date()
    onMonthCursorChange({ year: now.getFullYear(), month: now.getMonth() })
  }

  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth()

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
            const inMonth    = (m - 1) === month
            const dayLots    = lots.filter((l) => l.dueDate === day)
            const dayEvents  = getEventsForDay(events, day)
            const isToday    = day === today
            const isSelected = day === selectedDay
            const dayNum     = Number(day.split('-')[2])
            const visibleLots   = dayLots.slice(0, 2)
            const visibleEvents = dayEvents.slice(0, 2)
            const extraCount = (dayLots.length - visibleLots.length) + (dayEvents.length - visibleEvents.length)

            return (
              <button
                key={day}
                type="button"
                onClick={() => onDayClick(day)}
                className={`flex min-h-28 flex-col items-stretch gap-1 border-b border-r border-border-subtle p-1.5 text-left transition-colors hover:bg-surface-raised ${
                  isSelected ? 'bg-accent-dim' : inMonth ? '' : 'bg-surface-raised/60'
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? 'bg-green-700 text-white font-semibold' : inMonth ? 'text-fg-secondary' : 'text-fg-muted'
                }`}>
                  {dayNum}
                </span>
                <div className="flex flex-col gap-1">
                  {visibleLots.map((item) => {
                    const sc = siteColour(item.siteName)
                    return (
                      <span key={item.id} className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${sc.badge}`}>
                        {sc.abbr} {item.lotNumber}
                      </span>
                    )
                  })}
                  {visibleEvents.map((ev) => (
                    <span key={ev.id} className="truncate rounded border border-green-500/60 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400 bg-surface">
                      {ev.title}
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
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────

type FlatItem =
  | { kind: 'lot';   id: string; siteId: string; stageId: string; lotId: string;  label: string; site: string; stage: string; status: LotStatus;      due_date: string; tradesCompleted: string[]; readyForLandscaping: boolean }
  | { kind: 'job';   id: string; siteId: string; stageId: string;                 label: string; site: string; stage: string; status: ExtraJobStatus; due_date: string }
  | { kind: 'event'; id: string; title: string; description: string | null; startTime: string | null; endDate: string | null; due_date: string }

function ListView({ lots, jobs, events, today, onDayClick }: {
  lots: LotItem[]
  jobs: JobItem[]
  events: CalendarEvent[]
  today: string
  onDayClick: (day: string) => void
}) {
  const items: FlatItem[] = [
    ...lots.map((l): FlatItem => ({
      kind: 'lot', id: l.id, siteId: l.siteId, stageId: l.stageId, lotId: l.lotId,
      label: `Lot ${l.lotNumber}`, site: l.siteName, stage: l.stageName, status: l.status,
      due_date: l.dueDate, tradesCompleted: l.tradesCompleted, readyForLandscaping: l.readyForLandscaping,
    })),
    ...jobs.map((j): FlatItem => ({
      kind: 'job', id: j.id, siteId: j.siteId, stageId: j.stageId,
      label: j.title, site: j.siteName, stage: j.stageName, status: j.status, due_date: j.dueDate,
    })),
    // Events appear on their start date only (multi-day events not repeated)
    ...events.map((e): FlatItem => ({
      kind: 'event', id: e.id, title: e.title, description: e.description,
      startTime: e.startTime, endDate: e.endDate, due_date: e.eventDate,
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
    return <EmptyState text="No upcoming work or events with dates." />
  }

  return (
    <div className="space-y-5">
      {[...weeks.entries()].map(([weekStart, weekItems]) => {
        const isOverdue = weekStart < getWeekStart(today)
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
                if (item.kind === 'event') {
                  return (
                    <button
                      key={`event-${item.id}`}
                      type="button"
                      onClick={() => onDayClick(item.due_date)}
                      className="flex items-start gap-3 w-full px-4 py-3.5 hover:bg-surface-raised transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-fg">{item.title}</span>
                          <span className="rounded border border-green-500/60 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">Event</span>
                          {item.endDate && (
                            <span className="text-xs text-fg-muted">Until {formatDate(item.endDate)}</span>
                          )}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-fg-muted truncate">{item.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-fg-muted">{formatDate(item.due_date)}</p>
                        {item.startTime && <p className="text-xs text-fg-muted">{formatTime(item.startTime)}</p>}
                      </div>
                    </button>
                  )
                }

                const href = item.kind === 'lot'
                  ? `/sites/${item.siteId}/stages/${item.stageId}/lots/${item.lotId}`
                  : `/sites/${item.siteId}/stages/${item.stageId}/extra-jobs/${item.id}`

                const cfg = item.kind === 'lot'
                  ? (STATUS_CONFIG[item.status] ?? STATUS_CONFIG.not_started)
                  : (EXTRA_JOB_STATUS_CONFIG[item.status as ExtraJobStatus] ?? EXTRA_JOB_STATUS_CONFIG.not_started)

                return (
                  <Link key={item.id} href={href}
                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-raised transition-colors">
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

// ── Blocked lots view ─────────────────────────────────────────────────────────

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
  events: CalendarEvent[]
  sites: SiteOption[]
  today: string
  userId: string
  isAdmin: boolean
  canCreateEvents: boolean
}

export default function ScheduleView({ lotItems, jobItems, events, sites, today, userId, isAdmin, canCreateEvents }: Props) {
  const [view, setView] = useState<View>(() => {
    if (typeof window === 'undefined') return '2weeks'
    const saved = localStorage.getItem('schedule-view-preference')
    return (saved && VALID_VIEWS.includes(saved as View)) ? saved as View : '2weeks'
  })
  const [siteFilter, setSiteFilter]   = useState('')
  const [showBlocked, setShowBlocked] = useState(false)
  const [twoWeekOffset, setTwoWeekOffset] = useState(0)
  const [monthCursor, setMonthCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { year: y, month: m - 1 }
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  function changeView(v: View) {
    setView(v)
    setShowBlocked(false)
    localStorage.setItem('schedule-view-preference', v)
  }

  const lots = siteFilter ? lotItems.filter((l) => l.siteId === siteFilter) : lotItems
  const jobs = siteFilter ? jobItems.filter((j) => j.siteId === siteFilter) : jobItems

  const selectedDayLots   = selectedDay ? lots.filter((l) => l.dueDate === selectedDay) : []
  const selectedDayJobs   = selectedDay ? jobs.filter((j) => j.dueDate === selectedDay) : []
  const selectedDayEvents = selectedDay ? getEventsForDay(events, selectedDay) : []

  const views: Array<{ id: View; label: string }> = [
    { id: '2weeks', label: '2 Weeks' },
    { id: 'month',  label: 'Month'   },
    { id: 'list',   label: 'List'    },
  ]

  return (
    <>
      {selectedDay && (
        <EventDayPanel
          day={selectedDay}
          lots={selectedDayLots}
          jobs={selectedDayJobs}
          events={selectedDayEvents}
          canCreate={canCreateEvents}
          userId={userId}
          isAdmin={isAdmin}
          onClose={() => setSelectedDay(null)}
        />
      )}

      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => changeView(v.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  !showBlocked && view === v.id
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
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
                showBlocked ? 'bg-amber-600 text-white' : 'text-fg-muted hover:bg-surface-raised'
              }`}
            >
              Blocked lots
            </button>
          </div>

          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-border focus:outline-none"
          >
            <option value="">All sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {showBlocked ? (
          <BlockedView lots={lots} today={today} />
        ) : view === '2weeks' ? (
          <TwoWeekView
            lots={lots} jobs={jobs} events={events} today={today}
            offset={twoWeekOffset} onOffsetChange={setTwoWeekOffset}
            onDayClick={setSelectedDay}
          />
        ) : view === 'month' ? (
          <MonthView
            lots={lots} events={events} today={today}
            monthCursor={monthCursor} onMonthCursorChange={setMonthCursor}
            selectedDay={selectedDay} onDayClick={setSelectedDay}
          />
        ) : (
          <ListView lots={lots} jobs={jobs} events={events} today={today} onDayClick={setSelectedDay} />
        )}
      </div>
    </>
  )
}
