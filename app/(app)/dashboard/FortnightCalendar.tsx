import Link from 'next/link'
import { siteColour } from '@/lib/lotStatus'

export type CalendarItem = {
  date: string
  label: string
  siteName: string
  type: 'lot' | 'job'
  href: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function FortnightCalendar({ items }: { items: CalendarItem[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toYmd(today)

  // Build 14 days starting from today's Monday
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

  const itemsByDate = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const arr = itemsByDate.get(item.date) ?? []
    arr.push(item)
    itemsByDate.set(item.date, arr)
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-1 py-1.5 text-center text-xs font-medium text-stone-400">
            {d}
          </div>
        ))}
      </div>

      {/* Week 1 */}
      <div className="grid grid-cols-7 border-b border-stone-100">
        {days.slice(0, 7).map((day) => (
          <DayCell key={day.date} day={day} items={itemsByDate.get(day.date) ?? []} />
        ))}
      </div>

      {/* Week 2 */}
      <div className="grid grid-cols-7">
        {days.slice(7, 14).map((day) => (
          <DayCell key={day.date} day={day} items={itemsByDate.get(day.date) ?? []} />
        ))}
      </div>
    </div>
  )
}

function DayCell({
  day,
  items,
}: {
  day: { date: string; dayNum: number; dayLabel: string; isToday: boolean }
  items: CalendarItem[]
}) {
  return (
    <div
      className={`min-h-[72px] border-r border-stone-100 last:border-r-0 p-1 ${
        day.isToday ? 'bg-green-50 ring-1 ring-inset ring-green-200' : ''
      }`}
    >
      <div className={`text-xs font-medium mb-0.5 ${day.isToday ? 'text-green-700' : 'text-stone-500'}`}>
        {day.dayNum}
      </div>
      <div className="space-y-0.5">
        {items.slice(0, 4).map((item, i) => {
          const sc = siteColour(item.siteName)
          return (
            <Link
              key={i}
              href={item.href}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-stone-100 transition-colors"
            >
              <span className={`shrink-0 rounded px-1 text-[10px] font-bold leading-tight ${sc.badge}`}>
                {sc.abbr}
              </span>
              <span className="text-[10px] text-stone-700 truncate leading-tight">
                {item.label}
              </span>
            </Link>
          )
        })}
        {items.length > 4 && (
          <span className="text-[10px] text-stone-400 px-1">+{items.length - 4} more</span>
        )}
      </div>
    </div>
  )
}
