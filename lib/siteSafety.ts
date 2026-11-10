// Company and site safety details: the fields, how "filled" is counted, and
// when a site's review is overdue. Shared by Safety Admin, the per-site SWMS
// and the monthly safety review email.

export type CompanySafetyKey =
  | 'company_name' | 'abn' | 'address' | 'phone'
  | 'whs_contact_name' | 'whs_contact_phone' | 'safety_responsible_person'

export type SiteSafetyKey =
  | 'project_name' | 'project_address'
  | 'principal_contractor' | 'principal_contractor_contact' | 'principal_contractor_phone'
  | 'site_supervisor' | 'site_supervisor_phone'
  | 'nearest_hospital' | 'nearest_hospital_address' | 'nearest_hospital_phone'
  | 'assembly_point' | 'first_aid_kit_location' | 'fire_extinguisher_location'
  | 'site_hours' | 'site_access'
  | 'site_hazards' | 'environmental_controls' | 'required_ppe'

export type FieldDef<K extends string> = { key: K; label: string; multiline?: boolean }
export type FieldGroup<K extends string> = { title: string; fields: FieldDef<K>[] }

export const COMPANY_FIELDS: FieldDef<CompanySafetyKey>[] = [
  { key: 'company_name',              label: 'Company name' },
  { key: 'abn',                       label: 'ABN' },
  { key: 'address',                   label: 'Address' },
  { key: 'phone',                     label: 'Phone' },
  { key: 'whs_contact_name',          label: 'WHS contact' },
  { key: 'whs_contact_phone',         label: 'WHS contact phone' },
  { key: 'safety_responsible_person', label: 'Person responsible for safety' },
]

export const SITE_SAFETY_GROUPS: FieldGroup<SiteSafetyKey>[] = [
  { title: 'Project', fields: [
    { key: 'project_name',    label: 'Project name' },
    { key: 'project_address', label: 'Project address' },
  ] },
  { title: 'Principal contractor', fields: [
    { key: 'principal_contractor',         label: 'Principal contractor' },
    { key: 'principal_contractor_contact', label: 'Contact person' },
    { key: 'principal_contractor_phone',   label: 'Contact phone' },
  ] },
  { title: 'Site supervisor', fields: [
    { key: 'site_supervisor',       label: 'Site supervisor' },
    { key: 'site_supervisor_phone', label: 'Supervisor phone' },
  ] },
  { title: 'Emergency', fields: [
    { key: 'nearest_hospital',           label: 'Nearest hospital' },
    { key: 'nearest_hospital_address',   label: 'Hospital address' },
    { key: 'nearest_hospital_phone',     label: 'Hospital phone' },
    { key: 'assembly_point',             label: 'Assembly point' },
    { key: 'first_aid_kit_location',     label: 'First aid kit location' },
    { key: 'fire_extinguisher_location', label: 'Fire extinguisher location' },
  ] },
  { title: 'Site hours and access', fields: [
    { key: 'site_hours',  label: 'Site hours' },
    { key: 'site_access', label: 'Site access', multiline: true },
  ] },
  { title: 'Hazards and controls', fields: [
    { key: 'site_hazards',           label: 'Site hazards',           multiline: true },
    { key: 'environmental_controls', label: 'Environmental controls', multiline: true },
    { key: 'required_ppe',           label: 'Required PPE',           multiline: true },
  ] },
]

export const SITE_SAFETY_FIELDS: FieldDef<SiteSafetyKey>[] = SITE_SAFETY_GROUPS.flatMap(g => g.fields)
export const SITE_SAFETY_KEYS: SiteSafetyKey[] = SITE_SAFETY_FIELDS.map(f => f.key)
export const COMPANY_SAFETY_KEYS: CompanySafetyKey[] = COMPANY_FIELDS.map(f => f.key)

// Not copied by "Copy from another site" — they belong to the site itself
export const SITE_ONLY_KEYS: SiteSafetyKey[] = ['project_name', 'project_address']

export type SiteSafetyValues = Record<SiteSafetyKey, string>
export type CompanySafetyValues = Record<CompanySafetyKey, string>

export function emptySiteSafetyValues(): SiteSafetyValues {
  return Object.fromEntries(SITE_SAFETY_KEYS.map(k => [k, ''])) as SiteSafetyValues
}

// Picks the known keys from a row (or form), trimmed; null/undefined → ''
export function pickSiteSafety(row: Partial<Record<string, unknown>> | null | undefined): SiteSafetyValues {
  return Object.fromEntries(SITE_SAFETY_KEYS.map(k => [k, String(row?.[k] ?? '').trim()])) as SiteSafetyValues
}

export function pickCompanySafety(row: Partial<Record<string, unknown>> | null | undefined): CompanySafetyValues {
  return Object.fromEntries(COMPANY_SAFETY_KEYS.map(k => [k, String(row?.[k] ?? '').trim()])) as CompanySafetyValues
}

export function filledCount(values: SiteSafetyValues | null): number {
  if (!values) return 0
  return SITE_SAFETY_KEYS.filter(k => values[k].trim() !== '').length
}

// ── Review dates ──────────────────────────────────────────────────────────────

export const REVIEW_INTERVAL_MONTHS = 6

export function perthDateOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Australia/Perth' })
}

// Calendar months on a YYYY-MM-DD, clamped to the month's last day
// (31 Aug + 6 months = 28/29 Feb).
export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = total % 12
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  const nd = Math.min(d, lastDay)
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`
}

// Overdue once 6 months have passed since the last review (Perth dates).
// Never reviewed (no details saved yet) also counts as overdue.
export function isReviewOverdue(lastReviewedAt: string | null, todayPerth: string): boolean {
  if (!lastReviewedAt) return true
  return addMonthsYmd(perthDateOf(lastReviewedAt), REVIEW_INTERVAL_MONTHS) <= todayPerth
}
