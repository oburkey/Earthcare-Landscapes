import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SafetyView, {
  type SafetyDocRow,
  type SignoffRow,
  type SiteOption,
  type StaffOption,
  type VehicleOption,
  type ToolboxMeetingRow,
  type IncidentRow,
} from './SafetyView'
import { getPreStartsPage } from './actions'
import type { MyAssignmentRow } from './FormsTab'
import type { TemplateRow } from './FormTemplatesTab'
import type { AssignmentManagementRow } from './AssignFormsTab'
import type { SafetyFormType, FormSection } from '@/types/database'

export const metadata = { title: 'Safety — Earthcare Landscapes' }

type Db = Awaited<ReturnType<typeof createClient>>

// ── Independent fetch groups (each self-contained so they can run via Promise.all) ─

async function fetchSitesStaffVehicles(supabase: Db) {
  const [{ data: sitesRaw }, { data: staffRaw }, { data: vehiclesRaw }] = await Promise.all([
    supabase.from('sites').select('id, name').is('completed_at', null).order('name'),
    supabase.from('profiles').select('id, first_name, last_name').neq('role', 'client').order('last_name').order('first_name'),
    supabase.from('vehicles').select('id, make, model, registration, vehicle_type, current_hours, assigned_to').order('make'),
  ])
  return {
    sites:    (sitesRaw ?? [])    as SiteOption[],
    staff:    (staffRaw ?? [])    as StaffOption[],
    vehicles: (vehiclesRaw ?? []) as VehicleOption[],
  }
}

async function fetchDocsAndSignoffs(supabase: Db, profileId: string, isSupervisorPlus: boolean) {
  try {
    let signoffsQuery = supabase
      .from('document_signoffs')
      .select('id, document_id, signed_by, signed_at, signature_notes, profiles(first_name, last_name), safety_documents(title)')
      .order('signed_at', { ascending: false })
    if (!isSupervisorPlus) signoffsQuery = signoffsQuery.eq('signed_by', profileId)

    const [docsResult, mySignoffsResult, countResult, signoffsResult] = await Promise.all([
      supabase
        .from('safety_documents')
        .select('id, title, description, file_path, uploaded_by, created_at, profiles(first_name, last_name)')
        .order('created_at', { ascending: false }),
      supabase.from('document_signoffs').select('document_id').eq('signed_by', profileId),
      supabase.from('document_signoffs').select('document_id'),
      signoffsQuery,
    ])

    if (docsResult.error?.code === '42P01' || docsResult.error?.message?.includes('does not exist')) {
      return { safetyDocs: [] as SafetyDocRow[], mySignoffIds: [] as string[], signoffs: [] as SignoffRow[], docsExist: false }
    }
    if (docsResult.error) {
      return { safetyDocs: [] as SafetyDocRow[], mySignoffIds: [] as string[], signoffs: [] as SignoffRow[], docsExist: true }
    }

    const mySignoffIds = (mySignoffsResult.data ?? []).map(s => s.document_id)

    const countMap: Record<string, number> = {}
    for (const s of (countResult.data ?? [])) {
      countMap[s.document_id] = (countMap[s.document_id] ?? 0) + 1
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safetyDocs: SafetyDocRow[] = (docsResult.data ?? []).map((r: any): SafetyDocRow => ({
      id:           r.id,
      title:        r.title,
      description:  r.description,
      filePath:     r.file_path,
      uploadedBy:   r.uploaded_by,
      uploaderName: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Unknown',
      signoffCount: countMap[r.id] ?? 0,
      createdAt:    r.created_at,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signoffs: SignoffRow[] = (signoffsResult.data ?? []).map((r: any): SignoffRow => ({
      id:             r.id,
      documentId:     r.document_id,
      documentTitle:  r.safety_documents?.title ?? 'Unknown',
      signedBy:       r.signed_by,
      signerName:     r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Unknown',
      signedAt:       r.signed_at,
      signatureNotes: r.signature_notes,
    }))

    return { safetyDocs, mySignoffIds, signoffs, docsExist: true }
  } catch {
    return { safetyDocs: [] as SafetyDocRow[], mySignoffIds: [] as string[], signoffs: [] as SignoffRow[], docsExist: false }
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
          sites(name)
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
              sites(name)
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

  return { myAssignmentsRaw, templatesRaw, allAssignmentsRaw, safetyFormsExist }
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
    docsAndSignoffs,
    toolbox,
    incidentsResult,
    safetyForms,
  ] = await Promise.all([
    fetchSitesStaffVehicles(supabase),
    getPreStartsPage(0, 15),
    fetchDocsAndSignoffs(supabase, profile.id, isSupervisorPlus),
    fetchToolboxMeetings(supabase),
    fetchIncidents(supabase),
    fetchSafetyFormsRaw(supabase, profile.id, isSupervisorPlus),
  ])

  const preStarts         = preStartsPage.rows
  const preStartsExist    = !preStartsPage.tableMissing
  const preStartsHasMore  = preStartsPage.hasMore

  const { safetyDocs, mySignoffIds, signoffs, docsExist } = docsAndSignoffs
  const { toolboxMeetings, toolboxMeetingsExist } = toolbox
  const { incidents, incidentsExist } = incidentsResult
  const { myAssignmentsRaw, templatesRaw, allAssignmentsRaw, safetyFormsExist } = safetyForms

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myAssignments: MyAssignmentRow[] = myAssignmentsRaw.map((r: any): MyAssignmentRow => ({
    id:             r.id,
    templateId:     r.safety_form_templates?.id ?? '',
    templateTitle:  r.safety_form_templates?.title ?? 'Unknown',
    formType:       (r.safety_form_templates?.form_type ?? 'interactive') as SafetyFormType,
    isSiteSpecific: false,
    sections:       (r.safety_form_templates?.sections ?? []) as FormSection[],
    contentHtml:    r.safety_form_templates?.content_html ?? null,
    requireWitness: r.safety_form_templates?.require_witness ?? false,
    siteId:         r.site_id,
    siteName:       r.sites?.name ?? null,
    dueDate:        r.due_date,
    completedAt:    r.completed_at,
    createdAt:      r.created_at,
  }))

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
          safetyDocs={safetyDocs}
          mySignoffIds={mySignoffIds}
          signoffs={signoffs}
          toolboxMeetings={toolboxMeetings}
          incidents={incidents}
          myAssignments={myAssignments}
          templates={templates}
          allAssignments={allAssignments}
          preStartsHasMore={preStartsHasMore}
          tablesExist={{
            preStarts: preStartsExist,
            safetyDocuments: docsExist,
            toolboxMeetings: toolboxMeetingsExist,
            incidents: incidentsExist,
            safetyForms: safetyFormsExist,
          }}
        />
      </div>
    </div>
  )
}
