import { siteColour } from '@/lib/lotStatus'

export type PreStartDay = {
  label: string
  date: string
  sites: string[]
  isFuture: boolean
}

export default function PreStartsWeek({ days }: { days: PreStartDay[] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-stone-800 mb-3">Pre-starts this week</h2>
      <div className="grid grid-cols-5 gap-2">
        {days.map((day) => (
          <div
            key={day.date}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 min-h-[72px]"
          >
            <p className="text-xs font-medium text-stone-800">{day.label}</p>
            <p className="text-[10px] text-stone-400 mb-1.5">{formatShortDate(day.date)}</p>
            {day.isFuture ? (
              <p className="text-xs text-stone-400">Upcoming</p>
            ) : day.sites.length === 0 ? (
              <p className="text-xs text-stone-400">None</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {day.sites.map((siteName, i) => {
                  const sc = siteColour(siteName)
                  return (
                    <span
                      key={i}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sc.badge}`}
                    >
                      {sc.abbr}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
