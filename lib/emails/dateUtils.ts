// Date helpers for the scheduled email reports. Anchored explicitly to
// Australia/Perth (AWST, UTC+8, no DST) rather than the server's local clock —
// see FortnightCalendar.tsx for the same pattern used on the dashboard.

const PERTH_TZ = 'Australia/Perth'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Today's date in Perth, as a YYYY-MM-DD string.
export function todayInPerth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PERTH_TZ }).format(new Date())
}

// Adds `days` (may be negative) to a YYYY-MM-DD string, returning YYYY-MM-DD.
// Pure calendar-date arithmetic — no timezone involved once we have the string.
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

// Whole-day difference (a - b) for two YYYY-MM-DD strings.
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const diff = Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)
  return Math.round(diff / 86_400_000)
}

// [start, end) for the current month in Perth — end is exclusive (1st of next month).
export function currentMonthBoundsPerth(): { start: string; end: string; label: string } {
  const todayStr = todayInPerth()
  const [y, m] = todayStr.split('-').map(Number)
  const start = `${y}-${pad(m)}-01`
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const end = `${nextY}-${pad(nextM)}-01`
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-AU', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  return { start, end, label }
}

// Formats a YYYY-MM-DD (or null) as "6 Aug 2026" — no timezone conversion,
// since date-only columns have no attached time to shift.
export function formatDate(ymd: string | null): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

// Formats a timestamptz string as a Perth date, e.g. for created_at columns.
export function formatDateTimePerth(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: PERTH_TZ,
  })
}
