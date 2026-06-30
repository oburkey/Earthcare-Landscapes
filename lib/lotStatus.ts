import type { LotStatus, ExtraJobStatus } from '@/types/database'

export const STATUS_CONFIG: Record<
  LotStatus,
  { label: string; badge: string }
> = {
  not_started: {
    label: 'Not started',
    badge: 'bg-surface-raised text-fg-muted',
  },
  scheduled: {
    label: 'Scheduled',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  in_progress: {
    label: 'In progress',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  complete: {
    label: 'Complete',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  on_hold: {
    label: 'On hold',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
}

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG) as [
  LotStatus,
  { label: string; badge: string },
][]

export const EXTRA_JOB_STATUS_CONFIG: Record<
  ExtraJobStatus,
  { label: string; badge: string }
> = {
  not_started: { label: 'Not started', badge: 'bg-surface-raised text-fg-muted' },
  in_progress: { label: 'In progress', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  complete:    { label: 'Complete',    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
}

export const EXTRA_JOB_STATUS_OPTIONS = (
  Object.entries(EXTRA_JOB_STATUS_CONFIG) as [ExtraJobStatus, { label: string; badge: string }][]
).map(([value, { label }]) => ({ value, label }))

export const PHOTO_TYPE_LABELS: Record<string, string> = {
  before: 'Before',
  during: 'During',
  after:  'After',
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  site_plan:     'Site Plan',
  drawing:       'Drawing',
  housing_claim: 'Housing Claim',
  other:         'Other',
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(
    'en-AU',
    { day: 'numeric', month: 'short', year: 'numeric' }
  )
}

// ── Trades completed ──────────────────────────────────────────────────────────

export const TRADE_OPTIONS = ['Fencer', 'Concreter', 'Paver', 'Tiler', 'Roofer', 'Painter', 'Gates and Screening'] as const

export type Trade = typeof TRADE_OPTIONS[number]

export interface TradeStatusSummary {
  trades_completed: string[]
  ready_for_landscaping: boolean
}

// Small badge for stage overview / schedule lot cards. Returns null if no
// trades completed status has been recorded for the lot yet.
export function tradeStatusBadge(status: TradeStatusSummary | null | undefined): { label: string; badge: string } | null {
  if (!status) return null
  if (status.ready_for_landscaping) {
    return { label: 'Ready', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' }
  }
  const outstanding = TRADE_OPTIONS.filter((trade) => !status.trades_completed.includes(trade))
  const reason = outstanding.length > 0 ? `waiting on ${outstanding.join(', ')}` : 'see notes'
  return { label: `Blocked — ${reason}`, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
}

// ── Site colours & abbreviations ──────────────────────────────────────────────

export const SITE_COLOURS: Record<string, { abbr: string; badge: string }> = {
  'Tuart Lakes':   { abbr: 'TL', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  'Henley Brook':  { abbr: 'HB', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  'Piara Waters':  { abbr: 'PW', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  'Mandurah':      { abbr: 'MH', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
}

export function siteColour(siteName: string): { abbr: string; badge: string } {
  if (SITE_COLOURS[siteName]) return SITE_COLOURS[siteName]
  const match = Object.entries(SITE_COLOURS).find(([key]) => siteName.includes(key))
  return match
    ? match[1]
    : { abbr: siteName.slice(0, 2).toUpperCase(), badge: 'bg-surface-raised text-fg-muted' }
}
