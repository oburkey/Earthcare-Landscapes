'use client'

import { useRouter } from 'next/navigation'
import { siteColour } from '@/lib/lotStatus'

export type CalendarItem = {
  date: string
  label: string
  siteName: string
  type: 'lot' | 'job'
  href: string
}

export type DashboardCalendarEvent = {
  id: string
  title: string
  eventDate: string
  endDate: string | null
  startTime: string | null
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// This can render server-side (e.g. Vercel, which runs in UTC) — deriving "today"
// from the server's local clock would show the wrong calendar day for several
// hours every Australian morning. Anchor explicitly to the business's timezone
// (Australia/Perth).
function todayInPerth(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Perth' })
    .format(new Date())
  const [y, m, d] = parts.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? 'pm' : 'am'}`
}

export default function FortnightCalendar({
  items,
  events = [],
}: {
  items: CalendarItem[]
  events?: DashboardCalendarEvent[]
}) {
  const router = useRouter()
  const today = todayInPerth()
  const todayStr = toYmd(today)

  // Build 14 days starting from this Monday
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(monday.getDate() + mondayOffset)

  const days: { date: string; dayNum: number; dayLabel: string; isToday: boolean }[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    const dateStr = toYmd(d)
    days.push({
      date: dateStr,
      dayNum: d.getDate(),
      dayLabel: d.toLocaleDateString('en-AU', { weekday: 'short' }),
      isToday: dateStr === todayStr,
    })
  }

  function goToSchedule(date: string) {
    router.push(`/schedule?view=2weeks&date=${date}`)
  }

  const itemsByDate = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const arr = itemsByDate.get(item.date) ?? []
    arr.push(item)
    itemsByDate.set(item.date, arr)
  }

  // Expand multi-day events across all days in the visible window
  const eventsByDate = new Map<string, DashboardCalendarEvent[]>()
  for (const ev of events) {
    const end = ev.endDate ?? ev.eventDate
    for (const day of days) {
      if (day.date >= ev.eventDate && day.date <= end) {
        const arr = eventsByDate.get(day.date) ?? []
        arr.push(ev)
        eventsByDate.set(day.date, arr)
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-1 py-1.5 text-center text-xs font-medium text-fg-muted">
            {d}
          </div>
        ))}
      </div>

      {/* Week 1 */}
      <div className="grid grid-cols-7 border-b border-border-subtle">
        {days.slice(0, 7).map((day) => (
          <DayCell
            key={day.date}
            day={day}
            items={itemsByDate.get(day.date) ?? []}
            events={eventsByDate.get(day.date) ?? []}
            onOpen={() => goToSchedule(day.date)}
          />
        ))}
      </div>

      {/* Week 2 */}
      <div className="grid grid-cols-7">
        {days.slice(7, 14).map((day) => (
          <DayCell
            key={day.date}
            day={day}
            items={itemsByDate.get(day.date) ?? []}
            events={eventsByDate.get(day.date) ?? []}
            onOpen={() => goToSchedule(day.date)}
          />
        ))}
      </div>
    </div>
  )
}

function DayCell({
  day,
  items,
  events,
  onOpen,
}: {
  day: { date: string; dayNum: number; dayLabel: string; isToday: boolean }
  items: CalendarItem[]
  events: DashboardCalendarEvent[]
  onOpen: () => void
}) {
  const totalCount = items.length + events.length
  const visibleItems  = items.slice(0, 3)
  const visibleEvents = events.slice(0, Math.max(0, 4 - visibleItems.length))
  const extraCount    = totalCount - visibleItems.length - visibleEvents.length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className={`min-h-[72px] border-r border-border-subtle last:border-r-0 p-1 cursor-pointer hover:bg-surface-raised transition-colors ${
        day.isToday ? 'bg-accent-dim ring-1 ring-inset ring-green-200' : ''
      }`}
    >
      <div className={`text-xs font-medium mb-0.5 ${day.isToday ? 'text-accent-fg' : 'text-fg-muted'}`}>
        {day.dayNum}
      </div>
      <div className="space-y-0.5">
        {visibleItems.map((item, i) => {
          const sc = siteColour(item.siteName)
          return (
            <a
              key={i}
              href={item.href}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-surface-raised transition-colors"
            >
              <span className={`shrink-0 rounded px-1 text-[10px] font-bold leading-tight ${sc.badge}`}>
                {sc.abbr}
              </span>
              <span className="text-[10px] text-fg-secondary truncate leading-tight">
                {item.label}
              </span>
            </a>
          )
        })}
        {visibleEvents.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center gap-0.5 rounded border border-green-500/60 px-1 py-0.5"
          >
            <span className="text-[10px] font-medium text-green-700 dark:text-green-400 truncate leading-tight">
              {ev.startTime ? `${formatTime(ev.startTime)} ` : ''}{ev.title}
            </span>
          </div>
        ))}
        {extraCount > 0 && (
          <span className="text-[10px] text-fg-muted px-1">+{extraCount} more</span>
        )}
      </div>
    </div>
  )
}
