import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SafetyView, {
  type PreStartRow,
  type SafetyDocRow,
  type SignoffRow,
  type SiteOption,
  type StaffOption,
  type VehicleOption,
  type ToolboxMeetingRow,
  type IncidentRow,
} from './SafetyView'
import type { MyAssignmentRow } from './FormsTab'
import type { TemplateRow } from './FormTemplatesTab'
import type { AssignmentManagementRow } from './AssignFormsTab'
import type { SafetyFormType, FormSection } from '@/types/database'

export const metadata = { title: 'Safety — Earthcare Landscapes' }

export default async function SafetyPage() {
  const profile = await requireAuth()
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // Active sites
  const { data: sitesRaw } = await supabase
    .from('sites')
    .select('id, name')
    .is('completed_at', null)
    .order('name')
  const sites: SiteOption[] = (sitesRaw ?? []) as SiteOption[]

  // Staff (for crew selector) — all non-client profiles
  const { data: staffRaw } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .neq('role', 'client')
    .order('last_name')
    .order('first_name')
  const staff: StaffOption[] = (staffRaw ?? []) as StaffOption[]

  // Vehicles (for machinery selector — all types passed, filtered to Machinery in the form)
  const { data: vehiclesRaw } = await supabase
    .from('vehicles')
    .select('id, make, model, registration, vehicle_type, current_hours, assigned_to')
    .order('make')
  const vehicles: VehicleOption[] = (vehiclesRaw ?? []) as VehicleOption[]

  // ── Pre-starts ────────────────────────────────────────────────────────────────
  let preStarts: PreStartRow[] = []
  let preStartsExist = true

  try {
    const { data, error } = await supabase
      .from('pre_starts')
      .select(`
        id, site_id, submitted_by, date, crew_present, weather,
        site_hazards, ppe_confirmed, fit_for_work, using_machinery,
        machinery_checks, machine_id,
        using_truck, truck_id, truck_checks,
        using_trailer, trailer_checks,
        notes, created_at,
        sites(name), profiles(first_name, last_name)
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)

    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      preStartsExist = false
    } else if (!error) {
      // Fetch photo paths for all pre_starts (graceful if table doesn't exist)
      const preStartIds = (data ?? []).map((r: { id: string }) => r.id)
      const photosByPreStart: Record<string, string[]> = {}
      if (preStartIds.length > 0) {
        try {
          const { data: photosRaw } = await supabase
            .from('pre_start_photos')
            .select('pre_start_id, storage_path')
            .in('pre_start_id', preStartIds)
          for (const p of (photosRaw ?? [])) {
            if (!photosByPreStart[p.pre_start_id]) photosByPreStart[p.pre_start_id] = []
            photosByPreStart[p.pre_start_id].push(p.storage_path)
          }
        } catch { /* table may not exist yet */ }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preStarts = (data ?? []).map((r: any): PreStartRow => ({
        id:             r.id,
        siteId:         r.site_id,
        siteName:       r.sites?.name ?? 'Unknown',
        submittedBy:    r.submitted_by,
        submitterName:  r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Unknown',
        date:           r.date,
        crewPresent:    r.crew_present ?? [],
        weather:        r.weather ?? [],
        siteHazards:    r.site_hazards,
        ppeConfirmed:   r.ppe_confirmed,
        fitForWork:     r.fit_for_work,
        usingMachinery: r.using_machinery,
        machineryChecks: r.machinery_checks,
        machineId:      r.machine_id,
        usingTruck:     r.using_truck  ?? false,
        truckId:        r.truck_id     ?? null,
        truckChecks:    r.truck_checks ?? null,
        usingTrailer:   r.using_trailer ?? false,
        trailerChecks:  r.trailer_checks ?? null,
        notes:          r.notes,
        photoPaths:     photosByPreStart[r.id] ?? [],
        createdAt:      r.created_at,
      }))
    }
  } catch {
    preStartsExist = false
  }

  // ── Safety documents + signoffs ───────────────────────────────────────────────
  let safetyDocs: SafetyDocRow[] = []
  let mySignoffIds: string[] = []
  let signoffs: SignoffRow[] = []
  let docsExist = true

  try {
    const [docsResult, mySignoffsResult] = await Promise.all([
      supabase
        .from('safety_documents')
        .select('id, title, description, file_path, uploaded_by, created_at, profiles(first_name, last_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('document_signoffs')
        .select('document_id')
        .eq('signed_by', profile.id),
    ])

    if (docsResult.error?.code === '42P01' || docsResult.error?.message?.includes('does not exist')) {
      docsExist = false
    } else if (!docsResult.error) {
      mySignoffIds = (mySignoffsResult.data ?? []).map(s => s.document_id)

      // Per-document signoff counts
      const { data: countData } = await supabase.from('document_signoffs').select('document_id')
      const countMap: Record<string, number> = {}
      for (const s of (countData ?? [])) {
        countMap[s.document_id] = (countMap[s.document_id] ?? 0) + 1
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      safetyDocs = (docsResult.data ?? []).map((r: any): SafetyDocRow => ({
        id:           r.id,
        title:        r.title,
        description:  r.description,
        filePath:     r.file_path,
        uploadedBy:   r.uploaded_by,
        uploaderName: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Unknown',
        signoffCount: countMap[r.id] ?? 0,
        createdAt:    r.created_at,
      }))

      // Signoffs — all for supervisor+, own only for others
      const isSupervisorPlus = profile.role === 'supervisor' || profile.role === 'admin'
      let signoffsQuery = supabase
        .from('document_signoffs')
        .select('id, document_id, signed_by, signed_at, signature_notes, profiles(first_name, last_name), safety_documents(title)')
        .order('signed_at', { ascending: false })
      if (!isSupervisorPlus) {
        signoffsQuery = signoffsQuery.eq('signed_by', profile.id)
      }
      const { data: signoffsRaw } = await signoffsQuery

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signoffs = (signoffsRaw ?? []).map((r: any): SignoffRow => ({
        id:             r.id,
        documentId:     r.document_id,
        documentTitle:  r.safety_documents?.title ?? 'Unknown',
        signedBy:       r.signed_by,
        signerName:     r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : 'Unknown',
        signedAt:       r.signed_at,
        signatureNotes: r.signature_notes,
      }))
    }
  } catch {
    docsExist = false
  }

  // ── Toolbox meetings ──────────────────────────────────────────────────────────
  let toolboxMeetings: ToolboxMeetingRow[] = []
  let toolboxMeetingsExist = true

  try {
    const { data, error } = await supabase
      .from('toolbox_meetings')
      .select('id, site_id, date, topic, notes, attendees, submitted_by, created_at, sites(name), profiles(first_name, last_name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)

    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      toolboxMeetingsExist = false
    } else if (!error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toolboxMeetings = (data ?? []).map((r: any): ToolboxMeetingRow => ({
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
    }
  } catch {
    toolboxMeetingsExist = false
  }

  // ── Incidents ─────────────────────────────────────────────────────────────────
  let incidents: IncidentRow[] = []
  let incidentsExist = true

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
      incidentsExist = false
    } else if (!error) {
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
      incidents = (data ?? []).map((r: any): IncidentRow => ({
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
    }
  } catch {
    incidentsExist = false
  }

  // ── Safety Forms Engine ───────────────────────────────────────────────────
  let myAssignments:  MyAssignmentRow[]         = []
  let templates:      TemplateRow[]             = []
  let allAssignments: AssignmentManagementRow[] = []
  let safetyFormsExist = true

  try {
    // My assigned forms (all users)
    const { data: myAssignmentsRaw, error: myAssErr } = await supabase
      .from('safety_form_assignments')
      .select(`
        id, site_id, due_date, completed_at, created_at,
        safety_form_templates(id, title, form_type, sections, content_html, require_witness),
        sites(name)
      `)
      .eq('assigned_to', profile.id)
      .order('created_at', { ascending: false })

    if (myAssErr?.code === '42P01' || myAssErr?.message?.includes('does not exist')) {
      safetyFormsExist = false
    } else if (!myAssErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      myAssignments = (myAssignmentsRaw ?? []).map((r: any): MyAssignmentRow => ({
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

      // Templates (admin reads all, others get active only via RLS)
      const { data: templatesRaw } = await supabase
        .from('safety_form_templates')
        .select('id, title, form_type, description, is_site_specific, sections, content_html, require_witness, is_active, created_at')
        .order('created_at', { ascending: false })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      templates = (templatesRaw ?? []).map((r: any): TemplateRow => ({
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

      // All assignments (supervisor+ only)
      const isSupervisorPlus = profile.role === 'supervisor' || profile.role === 'admin'
      if (isSupervisorPlus) {
        const { data: allAssRaw } = await supabase
          .from('safety_form_assignments')
          .select(`
            id, assigned_to, site_id, due_date, completed_at, created_at,
            safety_form_templates(title, form_type),
            sites(name)
          `)
          .order('created_at', { ascending: false })
          .limit(500)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allAssignments = (allAssRaw ?? []).map((r: any): AssignmentManagementRow => {
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
      }
    }
  } catch {
    safetyFormsExist = false
  }

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
