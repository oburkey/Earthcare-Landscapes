import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import SafetyView, {
  type PreStartRow,
  type SafetyDocRow,
  type SignoffRow,
  type SiteOption,
  type StaffOption,
  type VehicleOption,
} from './SafetyView'

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

  // Staff members (for crew selector)
  const { data: staffRaw } = await supabase
    .from('staff_members')
    .select('id, full_name')
    .order('full_name')
  const staff: StaffOption[] = (staffRaw ?? []) as StaffOption[]

  // Vehicles (for machinery selector — all types passed, filtered to Machinery in the form)
  const { data: vehiclesRaw } = await supabase
    .from('vehicles')
    .select('id, make, model, registration, vehicle_type, current_hours')
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
        machinery_checks, machine_id, notes, created_at,
        sites(name), profiles(full_name)
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
        submitterName:  r.profiles?.full_name ?? 'Unknown',
        date:           r.date,
        crewPresent:    r.crew_present ?? [],
        weather:        r.weather ?? [],
        siteHazards:    r.site_hazards,
        ppeConfirmed:   r.ppe_confirmed,
        fitForWork:     r.fit_for_work,
        usingMachinery: r.using_machinery,
        machineryChecks: r.machinery_checks,
        machineId:      r.machine_id,
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
        .select('id, title, description, file_path, uploaded_by, created_at, profiles(full_name)')
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
        uploaderName: r.profiles?.full_name ?? 'Unknown',
        signoffCount: countMap[r.id] ?? 0,
        createdAt:    r.created_at,
      }))

      // Signoffs — all for supervisor+, own only for others
      const isSupervisorPlus = profile.role === 'supervisor' || profile.role === 'admin'
      let signoffsQuery = supabase
        .from('document_signoffs')
        .select('id, document_id, signed_by, signed_at, signature_notes, profiles(full_name), safety_documents(title)')
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
        signerName:     r.profiles?.full_name ?? 'Unknown',
        signedAt:       r.signed_at,
        signatureNotes: r.signature_notes,
      }))
    }
  } catch {
    docsExist = false
  }

  return (
    <div className="min-h-screen bg-stone-50">
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
          tablesExist={{ preStarts: preStartsExist, safetyDocuments: docsExist }}
        />
      </div>
    </div>
  )
}
