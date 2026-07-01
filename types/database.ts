// Hand-written database types matching our Supabase schema.
// When Supabase CLI is set up later, these can be generated automatically.

export type Role = 'worker' | 'leading_hand' | 'supervisor' | 'admin' | 'client'

export type LotStatus =
  | 'not_started'
  | 'scheduled'
  | 'in_progress'
  | 'complete'
  | 'on_hold'

export type ExtraJobStatus = 'not_started' | 'in_progress' | 'complete'

export type PhotoType = 'before' | 'during' | 'after'

export type DocumentType = 'site_plan' | 'drawing' | 'housing_claim' | 'other'

// ── Profiles ─────────────────────────────────────────────────────────────────
// One row per person, created automatically by the handle_new_user() trigger.
// has_login = false for stub entries (staff without app access).
export interface Profile {
  id: string           // matches auth.users.id
  first_name: string
  last_name: string
  email: string | null
  phone_number: string | null
  credentials: string[]
  role: Role
  has_login: boolean
  created_at: string
}

// ── Site plan documents ────────────────────────────────────────────────────────
export interface SitePlanDocument {
  id: string
  site_id: string
  storage_path: string
  label: string | null
  uploaded_by: string
  created_at: string
}

// ── Sites ─────────────────────────────────────────────────────────────────────
export interface Site {
  id: string
  name: string
  address: string | null
  client_contact: string | null
  site_plan_path: string | null  // path in 'site-plans' storage bucket
  completed_at: string | null    // null = active, timestamptz = marked complete
  has_client_extras: boolean
  created_at: string
}

// ── Stages ────────────────────────────────────────────────────────────────────
export interface Stage {
  id: string
  site_id: string
  name: string
  order: number
  site_plan_path: string | null  // path in 'site-plans' storage bucket
  completed_at: string | null    // null = active, timestamptz = marked complete
  created_at: string
}

// ── Lots ──────────────────────────────────────────────────────────────────────
export interface Lot {
  id: string
  stage_id: string
  lot_number: string
  address: string | null
  status: LotStatus
  due_date: string | null        // ISO date string (YYYY-MM-DD)
  scheduled_date: string | null
  completion_date: string | null
  notes: string | null
  has_client_extras: boolean
  extras_notes: string | null
  created_at: string
  updated_at: string
}

// ── Photos ────────────────────────────────────────────────────────────────────
export interface LotPhoto {
  id: string
  lot_id: string
  storage_path: string   // path in Supabase Storage bucket
  photo_type: PhotoType
  uploaded_by: string    // profile id
  created_at: string
}

// ── Documents ────────────────────────────────────────────────────────────────
export interface LotDocument {
  id: string
  lot_id: string
  storage_path: string
  document_name: string
  document_type: DocumentType
  uploaded_by: string
  created_at: string
}

// ── Invitations ───────────────────────────────────────────────────────────────
export interface Invitation {
  id: string
  email: string
  role: Role
  invited_by: string   // profile id of admin/supervisor who sent it
  token: string        // unique UUID used in the invite link
  accepted_at: string | null
  created_at: string
}

// ── Client Site Access ────────────────────────────────────────────────────────
// Controls which sites a client-role user can see.
export interface ClientSiteAccess {
  client_user_id: string
  site_id: string
}

// ── Contacts ──────────────────────────────────────────────────────────────────
// External contacts directory: suppliers, contractors, etc.
export interface Contact {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  category: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Extra Jobs ────────────────────────────────────────────────────────────────
export interface ExtraJob {
  id: string
  stage_id: string
  title: string
  description: string | null
  status: ExtraJobStatus
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Vehicles ──────────────────────────────────────────────────────────────────
export interface Vehicle {
  id: string
  make: string
  model: string
  year: number | null
  registration: string | null
  assigned_to: string | null
  rego_expiry_date: string | null
  insurance_expiry_date: string | null
  last_service_date: string | null
  last_service_hours: number | null
  last_service_odometer: number | null
  next_service_due_date: string | null
  next_service_km: number | null
  next_service_hours: number | null
  notes: string | null
  vehicle_type: string | null
  current_hours: number | null
  current_hours_updated_at: string | null
  created_at: string
}

export interface ExtraJobPhoto {
  id: string
  extra_job_id: string
  storage_path: string
  photo_type: PhotoType
  uploaded_by: string
  created_at: string
}

// ── Quote Template ────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'submitted' | 'approved'

export interface QuoteTemplateSection {
  id: string
  name: string
  order_index: number
  is_active: boolean
  is_client_extra: boolean
  created_at: string
}

export interface QuoteTemplateItem {
  id: string
  section_id: string
  name: string
  unit: string
  unit_price: number | null
  is_auto_calculated: boolean
  auto_calc_formula: string | null
  plant_category: 'front' | 'rear' | null
  order_index: number
  is_active: boolean
  created_at: string
}

export interface LotQuote {
  id: string
  lot_id: string
  is_estimated: boolean
  status: QuoteStatus
  quoted_by: string | null
  quoted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LotQuoteItem {
  id: string
  quote_id: string
  template_item_id: string | null
  item_name: string
  unit: string
  quantity: number | null
  unit_price_snapshot: number | null
  notes: string | null
  created_at: string
}

// ── Safety Forms Engine ───────────────────────────────────────────────────

export type FormItemType = 'checkbox' | 'yes_no' | 'text'
export type SafetyFormType = 'interactive' | 'swms' | 'jsa' | 'reference'

export interface FormItem {
  id: string
  label: string
  type: FormItemType
  required: boolean
}

export interface FormSection {
  title: string
  items: FormItem[]
}

export interface SafetyFormTemplate {
  id: string
  title: string
  form_type: SafetyFormType
  description: string | null
  is_site_specific: boolean
  sections: FormSection[]
  content_html: string | null
  require_witness: boolean
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface SafetyFormAssignment {
  id: string
  template_id: string
  assigned_to: string
  assigned_by: string
  site_id: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
}

export interface SafetyFormCompletion {
  id: string
  assignment_id: string
  profile_id: string
  responses: Record<string, boolean | 'yes' | 'no' | string>
  inductee_signature_path: string | null
  witness_signature_path: string | null
  completed_at: string
  notes: string | null
}

export interface SafetyReferenceDocument {
  id: string
  title: string
  site_id: string
  template_id: string | null
  content_html: string
  uploaded_by: string
  created_at: string
  updated_at: string
}

// ── Safety ────────────────────────────────────────────────────────────────────

export interface PreStart {
  id: string
  site_id: string
  submitted_by: string
  date: string
  crew_present: string[]
  weather: string[]
  site_hazards: string | null
  ppe_confirmed: boolean
  fit_for_work: boolean
  using_machinery: boolean
  machinery_checks: Record<string, string> | null
  machine_id: string | null
  notes: string | null
  created_at: string
}

export interface SafetyDocument {
  id: string
  title: string
  description: string | null
  file_path: string
  uploaded_by: string
  created_at: string
}

export interface DocumentSignoff {
  id: string
  document_id: string
  signed_by: string
  signed_at: string
  signature_notes: string | null
}

export interface ToolboxMeeting {
  id: string
  site_id: string
  date: string
  topic: string
  notes: string | null
  attendees: string[]
  submitted_by: string
  created_at: string
}

// ── Completion Checklist ─────────────────────────────────────────────────────
export type ChecklistSectionId = 'pre_checks' | 'landscaping_works' | 'finishing'
export type ChecklistResponse = 'yes' | 'no'

export interface LotChecklistItem {
  id: string
  lot_id: string
  section: ChecklistSectionId
  item_key: string
  completed: boolean
  response: ChecklistResponse | null
  completed_date: string | null
  created_at: string
  updated_at: string
}

// ── Trades Completed ──────────────────────────────────────────────────────────
// One row per lot, tracking which trades have completed their work and whether
// the lot is ready to be handed over for landscaping.
export interface LotTradeStatus {
  id: string
  lot_id: string
  trades_completed: string[]
  ready_for_landscaping: boolean
  blocking_notes: string | null
  updated_by: string | null
  updated_at: string
}

// ── Joined types (useful for queries that join tables) ────────────────────────
export interface LotWithStageAndSite extends Lot {
  stage: Stage & { site: Site }
}

export interface StageWithLots extends Stage {
  lots: Lot[]
}

export interface SiteWithStages extends Site {
  stages: StageWithLots[]
}
