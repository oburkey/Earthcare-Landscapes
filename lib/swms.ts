// Per-site SWMS: the details each site's SWMS keeps (copied from the company
// and site safety details when it is first assigned, then edited per job),
// and filling a SWMS template's {{placeholders}} with them.

import {
  COMPANY_FIELDS, SITE_SAFETY_GROUPS, COMPANY_SAFETY_KEYS, SITE_SAFETY_KEYS,
  type CompanySafetyKey, type SiteSafetyKey, type CompanySafetyValues, type SiteSafetyValues, type FieldGroup,
} from './siteSafety'

export type SwmsDetailKey = CompanySafetyKey | SiteSafetyKey
export type SwmsDetails = Record<SwmsDetailKey, string>

export const SWMS_DETAIL_KEYS: SwmsDetailKey[] = [...COMPANY_SAFETY_KEYS, ...SITE_SAFETY_KEYS]

export const SWMS_DETAIL_GROUPS: FieldGroup<SwmsDetailKey>[] = [
  { title: 'Company', fields: COMPANY_FIELDS },
  ...SITE_SAFETY_GROUPS,
]

// What a new site SWMS starts with
export function swmsDetailsFrom(company: CompanySafetyValues | null, site: SiteSafetyValues | null): SwmsDetails {
  return Object.fromEntries(SWMS_DETAIL_KEYS.map(k => [
    k,
    (COMPANY_SAFETY_KEYS as string[]).includes(k)
      ? company?.[k as CompanySafetyKey] ?? ''
      : site?.[k as SiteSafetyKey] ?? '',
  ])) as SwmsDetails
}

export function pickSwmsDetails(raw: unknown): SwmsDetails {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return Object.fromEntries(SWMS_DETAIL_KEYS.map(k => [k, String(obj[k] ?? '').trim()])) as SwmsDetails
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// "2026-11-10" → "10 Nov 2026"
function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export type SwmsFill = {
  details: SwmsDetails
  dateProvidedToPc: string | null  // YYYY-MM-DD
  reviewedByName: string | null
  reviewedAt: string | null        // YYYY-MM-DD
}

export const BLANK_SWMS_FILL: SwmsFill = {
  details: swmsDetailsFrom(null, null), dateProvidedToPc: null, reviewedByName: null, reviewedAt: null,
}

// Replaces {{key}} in a SWMS template with the site SWMS's values, escaped
// (line breaks kept). Unknown or blank placeholders become empty.
export function renderSwmsHtml(templateHtml: string | null, fill: SwmsFill): string | null {
  if (!templateHtml) return templateHtml
  const values: Record<string, string> = {
    ...fill.details,
    date_provided_to_pc: fill.dateProvidedToPc ? formatYmd(fill.dateProvidedToPc) : '',
    reviewed_by_name:    fill.reviewedByName ?? '',
    reviewed_at:         fill.reviewedAt ? formatYmd(fill.reviewedAt) : '',
  }
  return templateHtml.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) =>
    escapeHtml(values[key] ?? '').replace(/\r?\n/g, '<br>'))
}

// ── Induction: site information block ─────────────────────────────────────────
// Shown at the top of a site induction and saved with the completion.

const INDUCTION_KEYS: SiteSafetyKey[] = [
  'site_supervisor', 'site_supervisor_phone',
  'nearest_hospital', 'nearest_hospital_address', 'nearest_hospital_phone',
  'assembly_point', 'first_aid_kit_location', 'fire_extinguisher_location',
  'site_hours', 'site_access',
  'site_hazards', 'environmental_controls', 'required_ppe',
]

export type SiteInfoLine = { label: string; value: string }

export function inductionSiteInfo(site: SiteSafetyValues | null): SiteInfoLine[] | null {
  if (!site) return null
  const labels = new Map(SITE_SAFETY_GROUPS.flatMap(g => g.fields).map(f => [f.key, f.label]))
  return INDUCTION_KEYS.map(k => ({ label: labels.get(k) ?? k, value: site[k] }))
}
