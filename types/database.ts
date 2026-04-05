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
// One row per user, created automatically on signup via a DB trigger.
export interface Profile {
  id: string           // matches auth.users.id
  full_name: string
  phone_number: string | null
  credentials: string[]
  role: Role
  created_at: string
}

// ── Sites ─────────────────────────────────────────────────────────────────────
export interface Site {
  id: string
  name: string
  address: string | null
  client_contact: string | null
  site_plan_path: string | null  // path in 'site-plans' storage bucket
  created_at: string
}

// ── Stages ────────────────────────────────────────────────────────────────────
export interface Stage {
  id: string
  site_id: string
  name: string
  order: number
  site_plan_path: string | null  // path in 'site-plans' storage bucket
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

// ── Staff Members ─────────────────────────────────────────────────────────────
// Standalone staff directory, not tied to auth accounts.
export interface StaffMember {
  id: string
  full_name: string
  phone_number: string | null
  credentials: string[]
  role: Role
  created_at: string
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
