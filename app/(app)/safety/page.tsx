import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SafetyView, {
  type SiteOption,
  type StaffOption,
  type VehicleOption,
  type ToolboxMeetingRow,
  type IncidentRow,
} from './SafetyView'
import { getPreStartsPage } from './actions'
import type { MyAssignmentRow } from './FormsTab'
import type { TemplateRow } from './FormTemplatesTab'
import type { AssignmentManagementRow } from './FormsList'
import type { ReferenceDocAdminRow } from './ReferenceDocsAdmin'
import { todayInPerth } from '@/lib/emails/dateUtils'
import type { SiteSafetyRow } from './SiteSafetyDetails'
import { pickCompanySafety, pickSiteSafety, type CompanySafetyValues } from '@/lib/siteSafety'
import { renderSwmsHtml, pickSwmsDetails, inductionSiteInfo, BLANK_SWMS_FILL } from '@/lib/swms'
import type { SiteSwmsRow } from './SiteSwmsList'
import type { SafetyFormType, FormSection } from '@/types/database'

export const metadata = { title: 'Safety — Earthcare Landscapes' }

type Db = Awaited<ReturnType<typeof createClient>>

// ── Independent fetch groups (each self-contained so they can run via Promise.all) ─

async function fetchSitesStaffVehicles(supabase: Db) {
  const [{ data: sitesRaw }, { data: staffRaw }, { data: vehiclesRaw }] = await Promise.all([
    supabase.from('sites').select('id, name').is('completed_at', null).order('name'),
    supabase.from('profiles').select('id, first_name, last_name').neq('role', 'client').order('last_name').order('first_name'),
    supabase.from('vehicles').select('id, make, model, name, registration, vehicle_type, current_hours, assigned_to').order('make'),
  ])
  return {
    sites:    (sitesRaw ?? [])    as SiteOption[],
    staff:    (staffRaw ?? [])    as StaffOption[],
    vehicles: (vehiclesRaw ?? []) as VehicleOption[],
  }
}

// Safety Admin → Reference documents (all sites). Supervisor+ only.
async function fetchReferenceDocs(supabase: Db, isSupervisorPlus: boolean): Promise<ReferenceDocAdminRow[]> {
  if (!isSupervisorPlus) return []
  try {
    const { data, error } = await supabase
      .from('safety_reference_documents')
      .select('id, title, site_id, file_path, file_name, created_at, sites(name)')
      .order('created_at', { ascending: false })
    if (error) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any): ReferenceDocAdminRow => ({
      id:        r.id,
      title:     r.title,
      siteId:    r.site_id,
      siteName:  (Array.isArray(r.sites) ? r.sites[0]?.name : r.sites?.name) ?? 'Unknown site',
      fileName:  r.file_name ?? null,
      hasFile:   !!r.file_path,
      createdAt: r.created_at,
    }))
  } catch {
    return []
  }
}

// Safety Admin → Site safety details: company row + each site's details.
// Supervisor+ only. Mapped onto the active sites after Promise.all.
async function fetchSiteSafetyRaw(supabase: Db, isSupervisorPlus: boolean) {
  if (!isSupervisorPlus) return { company: null as CompanySafetyValues | null, siteRows: [] as Record<string, unknown>[] }
  try {
    const [{ data: companyRow }, { data: siteRows }] = await Promise.all([
      supabase.from('company_safety_details').select('*').eq('id', true).maybeSingle(),
      supabase.from('site_safety_details').select('*, reviewer:profiles!last_reviewed_by(first_name, last_name)'),
    ])
    return {
      company:  companyRow ? pickCompanySafety(companyRow) : null,
      siteRows: (siteRows ?? []) as Record<string, unknown>[],
    }
  } catch {
    return { company: null as CompanySafetyValues | null, siteRows: [] as Record<string, unknown>[] }
  }
}

async function fetchToolboxMeetings(supabase: Db) {
  try {
    const { data, error } = await supabase
      .from('toolbox_meetings')
      .select('id, site_id, date, topic, notes, attendees, submitted_by, created_at, sites(name), profiles(first_name, last_name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)

    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return { toolboxMeetings: [] as ToolboxMeetingRow[], toolboxMeetingsExist: false }
    }
    if (error) return { toolboxMeetings: [] as ToolboxMeetingRow[], toolboxMeetingsExist: true }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolboxMeetings: ToolboxMeetingRow[] = (data ?? []).map((r: any): ToolboxMeetingRow => ({
      id:            r.id,
      siteId:        r.site_id,
      siteName:      r.sites?.name ?? 'Unknown',
      date:          r.date,
      topic:         r.topic,
      notes:         r.notes,
      attendees:     r.attendees ?? [],
      submittedBy:   r.submitted_by,
      submitterName: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Unknown',
      createdAt:     r.created_at,
    }))
    return { toolboxMeetings, toolboxMeetingsExist: true }
  } catch {
    return { toolboxMeetings: [] as ToolboxMeetingRow[], toolboxMeetingsExist: false }
  }
}

async function fetchIncidents(supabase: Db) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select(`
        id, site_id, date, time, type, description,
        people_involved, immediate_action, reported_by, admin_notes, created_at,
        sites(name), profiles(first_name, last_name)
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)

    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return { incidents: [] as IncidentRow[], incidentsExist: false }
    }
    if (error) return { incidents: [] as IncidentRow[], incidentsExist: true }

    const incidentIds = (data ?? []).map((r: { id: string }) => r.id)
    const photosByIncident: Record<string, string[]> = {}
    if (incidentIds.length > 0) {
      try {
        const { data: photosRaw } = await supabase
          .from('incident_photos')
          .select('incident_id, storage_path')
          .in('incident_id', incidentIds)
        for (const p of (photosRaw ?? [])) {
          if (!photosByIncident[p.incident_id]) photosByIncident[p.incident_id] = []
          photosByIncident[p.incident_id].push(p.storage_path)
        }
      } catch { /* table may not exist yet */ }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incidents: IncidentRow[] = (data ?? []).map((r: any): IncidentRow => ({
      id:              r.id,
      siteId:          r.site_id,
      siteName:        r.sites?.name ?? 'Unknown',
      date:            r.date,
      time:            r.time ?? null,
      type:            r.type,
      description:     r.description,
      peopleInvolved:  r.people_involved ?? null,
      immediateAction: r.immediate_action ?? null,
      reportedBy:      r.reported_by,
      reporterName:    r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Unknown',
      adminNotes:      r.admin_notes ?? null,
      photoPaths:      photosByIncident[r.id] ?? [],
      createdAt:       r.created_at,
    }))
    return { incidents, incidentsExist: true }
  } catch {
    return { incidents: [] as IncidentRow[], incidentsExist: false }
  }
}

// Fetches raw rows only — mapping happens after Promise.all resolves, once
// `staff` (needed to resolve assignee names) is available.
async function fetchSafetyFormsRaw(supabase: Db, profileId: string, isSupervisorPlus: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let myAssignmentsRaw: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let templatesRaw: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allAssignmentsRaw: any[] = []
  let safetyFormsExist = true

  try {
    const [myAssResult, templatesResult, allAssResult] = await Promise.all([
      supabase
        .from('safety_form_assignments')
        .select(`
          id, site_id, due_date, completed_at, created_at,
          safety_form_templates(id, title, form_type, sections, content_html, require_witness),
          sites(name),
          site_swms(details, date_provided_to_pc, reviewed_by_name, reviewed_at)
        `)
        .eq('assigned_to', profileId)
        .order('created_at', { ascending: false }),
      // Templates are only needed by supervisor+ (Assign Forms + Form Templates tabs) —
      // skip the fetch entirely for worker/leading_hand.
      isSupervisorPlus
        ? supabase
            .from('safety_form_templates')
            .select('id, title, form_type, description, is_site_specific, sections, content_html, require_witness, is_active, created_at')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      isSupervisorPlus
        ? supabase
            .from('safety_form_assignments')
            .select(`
              id, assigned_to, site_id, due_date, completed_at, created_at,
              safety_form_templates(title, form_type),
              sites(name),
              safety_form_completions(id, completed_at, signed_pdf_path, signed_pdf_error)
            `)
            .order('created_at', { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (myAssResult.error?.code === '42P01' || myAssResult.error?.message?.includes('does not exist')) {
      safetyFormsExist = false
    } else if (!myAssResult.error) {
      myAssignmentsRaw    = myAssResult.data ?? []
      templatesRaw        = templatesResult.data ?? []
      allAssignmentsRaw   = allAssResult.data ?? []
    }
  } catch {
    safetyFormsExist = false
  }

  // Site safety details shown at the top of my site inductions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inductionSiteRows: any[] = []
  const inductionSiteIds = [...new Set(myAssignmentsRaw
    .filter(r => !r.completed_at && r.site_id && r.safety_form_templates?.form_type === 'interactive')
    .map(r => r.site_id as string))]
  if (inductionSiteIds.length > 0) {
    try {
      const { data } = await supabase.from('site_safety_details').select('*').in('site_id', inductionSiteIds)
      inductionSiteRows = data ?? []
    } catch { /* table may not exist yet */ }
  }

  return { myAssignmentsRaw, templatesRaw, allAssignmentsRaw, safetyFormsExist, inductionSiteRows }
}

// Safety Admin → each site's SWMS (supervisor+)
async function fetchSiteSwms(supabase: Db, isSupervisorPlus: boolean): Promise<SiteSwmsRow[]> {
  if (!isSupervisorPlus) return []
  try {
    const { data, error } = await supabase
      .from('site_swms')
      .select('id, site_id, template_id, details, date_provided_to_pc, reviewed_by_name, reviewed_at, updated_at, safety_form_templates(title)')
    if (error) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any): SiteSwmsRow => ({
      id:               r.id,
      siteId:           r.site_id,
      templateTitle:    (Array.isArray(r.safety_form_templates) ? r.safety_form_templates[0]?.title : r.safety_form_templates?.title) ?? 'SWMS',
      details:          pickSwmsDetails(r.details),
      dateProvidedToPc: r.date_provided_to_pc ?? null,
      reviewedByName:   r.reviewed_by_name ?? null,
      reviewedAt:       r.reviewed_at ?? null,
      updatedAt:        r.updated_at,
    }))
  } catch {
    return []
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SafetyPage() {
  const profile = await requireAuth()
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const isSupervisorPlus = profile.role === 'supervisor' || profile.role === 'admin'

  const [
    { sites, staff, vehicles },
    preStartsPage,
    referenceDocs,
    siteSafetyRaw,
    siteSwms,
    toolbox,
    incidentsResult,
    safetyForms,
  ] = await Promise.all([
    fetchSitesStaffVehicles(supabase),
    getPreStartsPage(0, 15),
    fetchReferenceDocs(supabase, isSupervisorPlus),
    fetchSiteSafetyRaw(supabase, isSupervisorPlus),
    fetchSiteSwms(supabase, isSupervisorPlus),
    fetchToolboxMeetings(supabase),
    fetchIncidents(supabase),
    fetchSafetyFormsRaw(supabase, profile.id, isSupervisorPlus),
  ])

  const preStarts         = preStartsPage.rows
  const preStartsExist    = !preStartsPage.tableMissing
  const preStartsHasMore  = preStartsPage.hasMore

  const { toolboxMeetings, toolboxMeetingsExist } = toolbox
  const { incidents, incidentsExist } = incidentsResult
  const { myAssignmentsRaw, templatesRaw, allAssignmentsRaw, safetyFormsExist, inductionSiteRows } = safetyForms

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myAssignments: MyAssignmentRow[] = myAssignmentsRaw.map((r: any): MyAssignmentRow => {
    const formType = (r.safety_form_templates?.form_type ?? 'interactive') as SafetyFormType
    // A SWMS shows its site's own details filled in (blank if it has none)
    const swms = Array.isArray(r.site_swms) ? r.site_swms[0] : r.site_swms
    const contentHtml = formType === 'swms' || formType === 'jsa'
      ? renderSwmsHtml(r.safety_form_templates?.content_html ?? null, swms
          ? { details: pickSwmsDetails(swms.details), dateProvidedToPc: swms.date_provided_to_pc, reviewedByName: swms.reviewed_by_name, reviewedAt: swms.reviewed_at }
          : BLANK_SWMS_FILL)
      : r.safety_form_templates?.content_html ?? null
    const siteRow = formType === 'interactive' && r.site_id
      ? inductionSiteRows.find((s: { site_id: string }) => s.site_id === r.site_id)
      : undefined
    return {
    id:             r.id,
    templateId:     r.safety_form_templates?.id ?? '',
    templateTitle:  r.safety_form_templates?.title ?? 'Unknown',
    formType,
    isSiteSpecific: false,
    sections:       (r.safety_form_templates?.sections ?? []) as FormSection[],
    contentHtml,
    siteInfo:       formType === 'interactive' && r.site_id ? inductionSiteInfo(siteRow ? pickSiteSafety(siteRow) : null) : null,
    requireWitness: r.safety_form_templates?.require_witness ?? false,
    siteId:         r.site_id,
    siteName:       r.sites?.name ?? null,
    dueDate:        r.due_date,
    completedAt:    r.completed_at,
    createdAt:      r.created_at,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templates: TemplateRow[] = templatesRaw.map((r: any): TemplateRow => ({
    id:             r.id,
    title:          r.title,
    formType:       r.form_type as SafetyFormType,
    description:    r.description,
    isSiteSpecific: r.is_site_specific,
    requireWitness: r.require_witness,
    sections:       (r.sections ?? []) as FormSection[],
    contentHtml:    r.content_html,
    isActive:       r.is_active,
    createdAt:      r.created_at,
  }))

  const allAssignments: AssignmentManagementRow[] = isSupervisorPlus
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? allAssignmentsRaw.map((r: any): AssignmentManagementRow => {
        const worker = staff.find(s => s.id === r.assigned_to)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completions = ((r.safety_form_completions ?? []) as any[])
          .slice()
          .sort((x, y) => String(y.completed_at).localeCompare(String(x.completed_at)))
        const latest = completions[0] ?? null
        return {
          id:            r.id,
          templateId:    '',
          templateTitle: r.safety_form_templates?.title ?? 'Unknown',
          formType:      (r.safety_form_templates?.form_type ?? 'interactive') as SafetyFormType,
          assignedTo:    r.assigned_to,
          assigneeName:  worker ? `${worker.first_name} ${worker.last_name}`.trim() : r.assigned_to,
          siteId:        r.site_id,
          siteName:      r.sites?.name ?? null,
          dueDate:       r.due_date,
          completedAt:   r.completed_at,
          createdAt:     r.created_at,
          completionId:  latest?.id ?? null,
          pdfStored:     !!latest?.signed_pdf_path,
          pdfError:      latest?.signed_pdf_error ?? null,
        }
      })
    : []

  const siteSafety: SiteSafetyRow[] = isSupervisorPlus
    ? sites.map((s): SiteSafetyRow => {
        const row = siteSafetyRaw.siteRows.find(r => r.site_id === s.id)
        const reviewerRaw = row?.reviewer as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null | undefined
        const reviewer = Array.isArray(reviewerRaw) ? reviewerRaw[0] : reviewerRaw
        return {
          siteId:             s.id,
          siteName:           s.name,
          details:            row ? pickSiteSafety(row) : null,
          lastReviewedAt:     (row?.last_reviewed_at as string | null | undefined) ?? null,
          lastReviewedByName: reviewer ? `${reviewer.first_name} ${reviewer.last_name}`.trim() : null,
        }
      })
    : []

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <SafetyView
          profile={profile}
          today={today}
          preStarts={preStarts}
          sites={sites}
          staff={staff}
          vehicles={vehicles}
          toolboxMeetings={toolboxMeetings}
          incidents={incidents}
          myAssignments={myAssignments}
          templates={templates}
          allAssignments={allAssignments}
          referenceDocs={referenceDocs}
          companySafety={siteSafetyRaw.company}
          siteSafety={siteSafety}
          siteSwms={siteSwms}
          todayPerth={todayInPerth()}
          preStartsHasMore={preStartsHasMore}
          tablesExist={{
            preStarts: preStartsExist,
            toolboxMeetings: toolboxMeetingsExist,
            incidents: incidentsExist,
            safetyForms: safetyFormsExist,
          }}
        />
      </div>
    </div>
  )
}
