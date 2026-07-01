'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { uploadToR2, deleteFromR2, getR2SignedUrlSafe } from '@/lib/r2'
import type { Role } from '@/types/database'

const ROLE_LEVEL: Record<Role, number> = {
  client: 0, worker: 1, leading_hand: 2, supervisor: 3, admin: 4,
}

export async function submitPreStart(formData: FormData) {
  const profile = await requireAuth()
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['leading_hand']) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()

  const siteId         = formData.get('site_id') as string
  const date           = formData.get('date') as string
  const crewPresent    = JSON.parse((formData.get('crew_present') as string) || '[]') as string[]
  const weather        = JSON.parse((formData.get('weather') as string) || '[]') as string[]
  const siteHazards    = (formData.get('site_hazards') as string) || null
  const ppeConfirmed   = formData.get('ppe_confirmed') === 'true'
  const fitForWork     = formData.get('fit_for_work') === 'true'
  const usingMachinery = formData.get('using_machinery') === 'true'
  const machineId      = (formData.get('machine_id') as string) || null
  const hoursRaw       = (formData.get('hours_today') as string)?.trim()
  const hoursToday     = hoursRaw ? (parseFloat(hoursRaw) ?? null) : null
  const machineryChecks = usingMachinery
    ? JSON.parse((formData.get('machinery_checks') as string) || 'null')
    : null
  const usingTruck     = formData.get('using_truck') === 'true'
  const truckId        = (formData.get('truck_id') as string) || null
  const truckChecks    = usingTruck
    ? JSON.parse((formData.get('truck_checks') as string) || 'null')
    : null
  const usingTrailer   = formData.get('using_trailer') === 'true'
  const trailerChecks  = usingTrailer
    ? JSON.parse((formData.get('trailer_checks') as string) || 'null')
    : null
  const notes          = (formData.get('notes') as string) || null

  if (!siteId) return { error: 'Site is required' }
  if (!date)   return { error: 'Date is required' }

  const { data, error } = await supabase
    .from('pre_starts')
    .insert({
      site_id:          siteId,
      submitted_by:     profile.id,
      date,
      crew_present:     crewPresent,
      weather,
      site_hazards:     siteHazards,
      ppe_confirmed:    ppeConfirmed,
      fit_for_work:     fitForWork,
      using_machinery:  usingMachinery,
      machinery_checks: machineryChecks,
      machine_id:       usingMachinery ? machineId : null,
      using_truck:      usingTruck,
      truck_id:         usingTruck ? truckId : null,
      truck_checks:     truckChecks,
      using_trailer:    usingTrailer,
      trailer_checks:   trailerChecks,
      notes,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Set vehicle meter reading (replaces stored value — number entered IS the current reading)
  if (usingMachinery && machineId && hoursToday !== null) {
    try {
      await supabase
        .from('vehicles')
        .update({
          current_hours: hoursToday,
          current_hours_updated_at: new Date().toISOString(),
        })
        .eq('id', machineId)
    } catch { /* non-fatal */ }
  }

  // Upload attached photos
  const photoPaths: string[] = []
  for (let i = 0; i < 20; i++) {
    const photo = formData.get(`photo_${i}`) as File | null
    if (!photo || !photo.size) break
    try {
      const bytes  = await photo.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const key = `pre-start-photos/${data.id}/${Date.now()}-${i}-${safeName}`
      await uploadToR2(key, buffer, photo.type || 'image/jpeg')
      await supabase.from('pre_start_photos').insert({
        pre_start_id: data.id,
        storage_path: key,
        uploaded_by:  profile.id,
      })
      photoPaths.push(key)
    } catch { /* non-fatal: don't fail submission over a photo */ }
  }

  revalidatePath('/safety')
  return { success: true, id: data.id, photoPaths }
}

export async function uploadSafetyDocument(formData: FormData) {
  const profile = await requireAuth()
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['supervisor']) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()

  const title       = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string) || null
  const file        = formData.get('file') as File

  if (!title)            return { error: 'Title is required' }
  if (!file || !file.size) return { error: 'File is required' }

  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key    = `safety-documents/${Date.now()}-${safeName}`

  await uploadToR2(key, buffer, file.type || 'application/octet-stream')

  const { data, error } = await supabase
    .from('safety_documents')
    .insert({
      title,
      description,
      file_path: key,
      uploaded_by: profile.id,
    })
    .select('id, title, description, file_path, uploaded_by, created_at')
    .single()

  if (error) {
    await deleteFromR2(key).catch(() => {})
    return { error: error.message }
  }

  revalidatePath('/safety')
  return {
    success: true,
    doc: {
      id:           data.id,
      title:        data.title,
      description:  data.description,
      filePath:     data.file_path,
      uploadedBy:   data.uploaded_by,
      uploaderName: `${profile.first_name} ${profile.last_name}`.trim(),
      signoffCount: 0,
      createdAt:    data.created_at,
    },
  }
}

export async function deleteSafetyDocument(documentId: string, filePath: string) {
  const profile = await requireAuth()
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['supervisor']) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('safety_documents').delete().eq('id', documentId)
  if (error) return { error: error.message }

  await deleteFromR2(filePath).catch(() => {})

  revalidatePath('/safety')
  return { success: true }
}

export async function signOffDocument(documentId: string, signatureNotes: string) {
  const profile = await requireAuth()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('document_signoffs')
    .select('id')
    .eq('document_id', documentId)
    .eq('signed_by', profile.id)
    .maybeSingle()

  if (existing) return { error: 'Already signed off on this document' }

  const { data, error } = await supabase
    .from('document_signoffs')
    .insert({
      document_id:     documentId,
      signed_by:       profile.id,
      signature_notes: signatureNotes || null,
    })
    .select('id, document_id, signed_at, signature_notes')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/safety')
  return {
    success: true,
    signoff: {
      id:              data.id,
      documentId:      data.document_id,
      documentTitle:   '',
      signedBy:        profile.id,
      signerName:      `${profile.first_name} ${profile.last_name}`.trim(),
      signedAt:        data.signed_at,
      signatureNotes:  data.signature_notes,
    },
  }
}

export async function updatePreStart(id: string, fields: {
  date: string
  siteId: string
  crewPresent: string[]
  weather: string[]
  siteHazards: string | null
  ppeConfirmed: boolean
  fitForWork: boolean
  notes: string | null
}) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  if (!fields.date)   return { error: 'Date is required' }
  if (!fields.siteId) return { error: 'Site is required' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('pre_starts')
    .update({
      date:          fields.date,
      site_id:       fields.siteId,
      crew_present:  fields.crewPresent,
      weather:       fields.weather,
      site_hazards:  fields.siteHazards,
      ppe_confirmed: fields.ppeConfirmed,
      fit_for_work:  fields.fitForWork,
      notes:         fields.notes,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/safety')
  return { success: true }
}

export async function deletePreStart(preStartId: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()

  // Fetch photo paths before deleting so we can clean up R2
  const { data: photos } = await supabase
    .from('pre_start_photos')
    .select('storage_path')
    .eq('pre_start_id', preStartId)

  for (const photo of (photos ?? [])) {
    await deleteFromR2(photo.storage_path).catch(() => {})
  }

  // Delete the record — cascades to pre_start_photos in DB
  const { error } = await supabase
    .from('pre_starts')
    .delete()
    .eq('id', preStartId)

  if (error) return { error: error.message }

  revalidatePath('/safety')
  return { success: true }
}

export async function getSafetyDocUrl(filePath: string): Promise<string> {
  await requireAuth()
  return getR2SignedUrlSafe(filePath, 300)
}

export async function submitToolboxMeeting(formData: FormData) {
  const profile = await requireAuth()
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['leading_hand']) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()

  const siteId    = formData.get('site_id') as string
  const date      = formData.get('date') as string
  const topic     = (formData.get('topic') as string)?.trim()
  const notes     = (formData.get('notes') as string) || null
  const attendees = JSON.parse((formData.get('attendees') as string) || '[]') as string[]

  if (!siteId) return { error: 'Site is required' }
  if (!date)   return { error: 'Date is required' }
  if (!topic)  return { error: 'Topic is required' }

  const { data, error } = await supabase
    .from('toolbox_meetings')
    .insert({
      site_id:      siteId,
      date,
      topic,
      notes,
      attendees,
      submitted_by: profile.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/safety')
  return { success: true, id: data.id }
}

export async function deleteToolboxMeeting(id: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('toolbox_meetings')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/safety')
  return { success: true }
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export async function submitIncident(formData: FormData) {
  const profile = await requireAuth()
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['leading_hand']) {
    return { error: 'Insufficient permissions' }
  }

  const supabase = await createClient()

  const siteId          = formData.get('site_id') as string
  const date            = formData.get('date') as string
  const time            = (formData.get('time') as string) || null
  const type            = formData.get('type') as string
  const description     = (formData.get('description') as string)?.trim()
  const peopleInvolved  = (formData.get('people_involved') as string)?.trim() || null
  const immediateAction = (formData.get('immediate_action') as string)?.trim() || null

  if (!siteId)       return { error: 'Site is required' }
  if (!date)         return { error: 'Date is required' }
  if (!description)  return { error: 'Description is required' }

  const VALID_TYPES = ['incident', 'near_miss', 'first_aid', 'property_damage']
  if (!VALID_TYPES.includes(type)) return { error: 'Invalid type' }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      site_id:          siteId,
      date,
      time:             time || null,
      type,
      description,
      people_involved:  peopleInvolved,
      immediate_action: immediateAction,
      reported_by:      profile.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const photoPaths: string[] = []
  for (let i = 0; i < 10; i++) {
    const photo = formData.get(`photo_${i}`) as File | null
    if (!photo || !photo.size) break
    try {
      const bytes  = await photo.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const key = `incident-photos/${data.id}/${Date.now()}-${i}-${safeName}`
      await uploadToR2(key, buffer, photo.type || 'image/jpeg')
      await supabase.from('incident_photos').insert({
        incident_id:  data.id,
        storage_path: key,
        uploaded_by:  profile.id,
      })
      photoPaths.push(key)
    } catch { /* non-fatal */ }
  }

  revalidatePath('/safety')
  return { success: true, id: data.id, photoPaths }
}

export async function updateIncidentAdminNotes(id: string, notes: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('incidents')
    .update({ admin_notes: notes || null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/safety')
  return { success: true }
}

export async function deleteIncident(id: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()

  const { data: photos } = await supabase
    .from('incident_photos')
    .select('storage_path')
    .eq('incident_id', id)

  for (const photo of (photos ?? [])) {
    await deleteFromR2(photo.storage_path).catch(() => {})
  }

  const { error } = await supabase.from('incidents').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/safety')
  return { success: true }
}

export async function getIncidentPhotoUrl(path: string): Promise<string> {
  await requireAuth()
  return getR2SignedUrlSafe(path, 300)
}
