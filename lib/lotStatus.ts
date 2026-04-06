import type { LotStatus, ExtraJobStatus } from '@/types/database'

export const STATUS_CONFIG: Record<
  LotStatus,
  { label: string; badge: string }
> = {
  not_started: {
    label: 'Not started',
    badge: 'bg-stone-100 text-stone-600',
  },
  scheduled: {
    label: 'Scheduled',
    badge: 'bg-blue-100 text-blue-700',
  },
  in_progress: {
    label: 'In progress',
    badge: 'bg-amber-100 text-amber-700',
  },
  complete: {
    label: 'Complete',
    badge: 'bg-green-100 text-green-700',
  },
  on_hold: {
    label: 'On hold',
    badge: 'bg-red-100 text-red-700',
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
  not_started: { label: 'Not started', badge: 'bg-stone-100 text-stone-600' },
  in_progress: { label: 'In progress', badge: 'bg-blue-100 text-blue-700' },
  complete:    { label: 'Complete',    badge: 'bg-green-100 text-green-700' },
}

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
