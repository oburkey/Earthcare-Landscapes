'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { uploadToR2, deleteFromR2, getR2FileAsDataUrl, getR2SignedUrl } from '@/lib/r2'
import type { Role, SafetyFormType, FormSection } from '@/types/database'

const ROLE_LEVEL: Record<Role, number> = {
  client: 0, worker: 1, leading_hand: 2, supervisor: 3, admin: 4,
}

// ── Templates ─────────────────────────────────────────────────────────────

export async function createTemplate(data: {
  title: string
  form_type: SafetyFormType
  description: string | null
  is_site_specific: boolean
  sections: FormSection[]
  content_html: string | null
  require_witness: boolean
}) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('safety_form_templates')
    .insert({ ...data, created_by: profile.id })
    .select('id, title, form_type, description, is_site_specific, sections, content_html, require_witness, is_active, created_at')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/safety')
  return { success: true, template: row }
}

export async function updateTemplate(id: string, data: {
  title: string
  description: string | null
  is_site_specific: boolean
  sections: FormSection[]
  content_html: string | null
  require_witness: boolean
}) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('safety_form_templates')
    .update(data)
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!rows || rows.length === 0) return { error: 'Template not found, or you do not have permission to edit it.' }
  revalidatePath('/safety')
  return { success: true }
}

export async function setTemplateActive(id: string, isActive: boolean) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('safety_form_templates')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!rows || rows.length === 0) return { error: 'Template not found, or you do not have permission to edit it.' }
  revalidatePath('/safety')
  return { success: true }
}

// ── Assignments ───────────────────────────────────────────────────────────

export async function assignForm(data: {
  template_id: string
  worker_ids: string[]
  site_id: string | null
  due_date: string | null
}) {
  const profile = await requireAuth()
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['supervisor']) return { error: 'Supervisor access required' }

  const supabase = await createClient()

  const errors: string[] = []
  const created: string[] = []

  for (const workerId of data.worker_ids) {
    // Prevent duplicate pending assignments
    const { data: existing } = await supabase
      .from('safety_form_assignments')
      .select('id')
      .eq('template_id', data.template_id)
      .eq('assigned_to', workerId)
      .is('completed_at', null)
      .maybeSingle()

    if (existing) {
      errors.push(`Worker already has a pending assignment for this form`)
      continue
    }

    const { data: row, error } = await supabase
      .from('safety_form_assignments')
      .insert({
        template_id:  data.template_id,
        assigned_to:  workerId,
        assigned_by:  profile.id,
        site_id:      data.site_id,
        due_date:     data.due_date,
      })
      .select('id')
      .single()

    if (error) errors.push(error.message)
    else created.push(row.id)
  }

  revalidatePath('/safety')
  if (created.length === 0) return { error: errors[0] ?? 'No assignments created' }
  return { success: true, created, errors: errors.length > 0 ? errors : undefined }
}

export async function revokeAssignment(id: string) {
  const profile = await requireAuth()
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['supervisor']) return { error: 'Supervisor access required' }

  const supabase = await createClient()

  // Only allow revoking incomplete assignments
  const { data: assignment } = await supabase
    .from('safety_form_assignments')
    .select('completed_at')
    .eq('id', id)
    .single()

  if (assignment?.completed_at) return { error: 'Cannot revoke a completed assignment' }

  const { data: rows, error } = await supabase
    .from('safety_form_assignments')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!rows || rows.length === 0) return { error: 'Could not revoke — only admins can revoke assignments.' }
  revalidatePath('/safety')
  return { success: true }
}

// ── Form Completion ───────────────────────────────────────────────────────

export async function submitFormCompletion(formData: FormData) {
  const profile = await requireAuth()
  const supabase = await createClient()
  const admin = createAdminClient()

  const assignmentId  = formData.get('assignment_id') as string
  const responsesRaw  = formData.get('responses') as string
  const notes         = (formData.get('notes') as string) || null

  if (!assignmentId) return { error: 'Assignment ID required' }

  // Verify assignment belongs to this user
  const { data: assignment } = await supabase
    .from('safety_form_assignments')
    .select('id, completed_at')
    .eq('id', assignmentId)
    .eq('assigned_to', profile.id)
    .single()

  if (!assignment) return { error: 'Assignment not found' }
  if (assignment.completed_at) return { error: 'Assignment already completed' }

  const responses = JSON.parse(responsesRaw || '{}')
  const now = new Date().toISOString()

  // Exactly what this person is signing, built here from the database —
  // never taken from the browser.
  const snapshot = await buildCompletionSnapshot(admin, assignmentId)
  if ('error' in snapshot) return { error: snapshot.error }

  // Upload inductee signature
  let inducteeSignaturePath: string | null = null
  const inducteeSig = formData.get('inductee_signature') as File | null
  if (inducteeSig && inducteeSig.size > 0) {
    try {
      const buf = Buffer.from(await inducteeSig.arrayBuffer())
      const key = `form-signatures/${assignmentId}/inductee-${Date.now()}.png`
      await uploadToR2(key, buf, 'image/png')
      inducteeSignaturePath = key
    } catch { /* non-fatal */ }
  }

  // Upload witness signature
  let witnessSignaturePath: string | null = null
  const witnessSig = formData.get('witness_signature') as File | null
  if (witnessSig && witnessSig.size > 0) {
    try {
      const buf = Buffer.from(await witnessSig.arrayBuffer())
      const key = `form-signatures/${assignmentId}/witness-${Date.now()}.png`
      await uploadToR2(key, buf, 'image/png')
      witnessSignaturePath = key
    } catch { /* non-fatal */ }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('safety_form_completions')
    .insert({
      assignment_id:           assignmentId,
      profile_id:              profile.id,
      responses,
      inductee_signature_path: inducteeSignaturePath,
      witness_signature_path:  witnessSignaturePath,
      completed_at:            now,
      notes,
      ...snapshot,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    if (inducteeSignaturePath) await deleteFromR2(inducteeSignaturePath).catch(() => {})
    if (witnessSignaturePath)  await deleteFromR2(witnessSignaturePath).catch(() => {})
    return { error: insertError?.message ?? 'Could not save the completed form.' }
  }

  // Mark assignment complete (bypasses RLS — worker has no UPDATE on assignments)
  await admin
    .from('safety_form_assignments')
    .update({ completed_at: now })
    .eq('id', assignmentId)

  revalidatePath('/safety')
  return { success: true, completionId: inserted.id as string }
}

// ── Snapshot of what is signed ────────────────────────────────────────────

type CompletionSnapshot = {
  template_title_snapshot: string
  content_snapshot_html:   string | null
  sections_snapshot:       FormSection[] | null
  site_details_snapshot:   Record<string, string> | null
}

async function buildCompletionSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  assignmentId: string
): Promise<CompletionSnapshot | { error: string }> {
  const { data, error } = await admin
    .from('safety_form_assignments')
    .select('id, safety_form_templates(title, form_type, sections, content_html)')
    .eq('id', assignmentId)
    .single()
  if (error || !data) return { error: 'Could not load the form being signed.' }

  const tpl = (Array.isArray(data.safety_form_templates) ? data.safety_form_templates[0] : data.safety_form_templates) as
    | { title: string; form_type: string; sections: FormSection[] | null; content_html: string | null }
    | null
  if (!tpl) return { error: 'Could not load the form being signed.' }

  const isDocument = tpl.form_type === 'swms' || tpl.form_type === 'jsa'
  return {
    template_title_snapshot: tpl.title,
    content_snapshot_html:   isDocument ? tpl.content_html : null,
    sections_snapshot:       tpl.form_type === 'interactive' ? (tpl.sections ?? []) : null,
    site_details_snapshot:   null,
  }
}

// ── Completed form PDF data ───────────────────────────────────────────────

type CompletionPdfData = {
  completionId: string
  workerName: string
  siteName: string | null
  completedAt: string
  formType: SafetyFormType
  templateTitle: string
  sections: FormSection[]
  contentHtml: string | null
  requireWitness: boolean
  responses: Record<string, boolean | 'yes' | 'no' | string>
  inducteeSignatureUrl: string | null
  witnessSignatureUrl: string | null
  notes: string | null
}

export async function getCompletionPdfData(
  assignmentId: string
): Promise<CompletionPdfData | { error: string }> {
  const profile = await requireAuth()
  const admin   = createAdminClient()

  const { data: asgn, error: aErr } = await admin
    .from('safety_form_assignments')
    .select(`
      id, assigned_to,
      profiles!assigned_to (first_name, last_name),
      sites (name),
      safety_form_templates (form_type, require_witness)
    `)
    .eq('id', assignmentId)
    .single()

  if (aErr || !asgn) return { error: 'Assignment not found' }

  // Workers / leading hands can only download their own completed forms
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['supervisor'] && asgn.assigned_to !== profile.id) {
    return { error: 'Access denied' }
  }

  const { data: comp, error: cErr } = await admin
    .from('safety_form_completions')
    .select('id, responses, inductee_signature_path, witness_signature_path, completed_at, notes, template_title_snapshot, content_snapshot_html, sections_snapshot')
    .eq('assignment_id', assignmentId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cErr || !comp) return { error: 'Completion record not found' }

  // Supabase join results can be objects or single-element arrays depending on schema hints
  const workerProfile = (Array.isArray(asgn.profiles) ? asgn.profiles[0] : asgn.profiles) as
    | { first_name: string; last_name: string }
    | null
  const site = (Array.isArray(asgn.sites) ? asgn.sites[0] : asgn.sites) as
    | { name: string }
    | null
  const template = (
    Array.isArray(asgn.safety_form_templates)
      ? asgn.safety_form_templates[0]
      : asgn.safety_form_templates
  ) as {
    form_type: string
    require_witness: boolean
  } | null

  if (!workerProfile || !template) return { error: 'Related data not found' }
  // PDFs print only what was signed — never today's template
  if (!comp.template_title_snapshot) return { error: 'This completion has no saved copy of the signed form.' }

  const [inducteeUrl, witnessUrl] = await Promise.all([
    comp.inductee_signature_path
      ? getR2FileAsDataUrl(comp.inductee_signature_path)
      : Promise.resolve(''),
    comp.witness_signature_path
      ? getR2FileAsDataUrl(comp.witness_signature_path)
      : Promise.resolve(''),
  ])

  return {
    completionId:        comp.id as string,
    workerName:          `${workerProfile.first_name} ${workerProfile.last_name}`.trim(),
    siteName:            site?.name ?? null,
    completedAt:         comp.completed_at as string,
    formType:            template.form_type as SafetyFormType,
    templateTitle:       comp.template_title_snapshot as string,
    sections:            (comp.sections_snapshot as FormSection[] | null) ?? [],
    contentHtml:         (comp.content_snapshot_html as string | null) ?? null,
    requireWitness:      template.require_witness || !!comp.witness_signature_path,
    responses:           (comp.responses as Record<string, boolean | 'yes' | 'no' | string>) ?? {},
    inducteeSignatureUrl: inducteeUrl || null,
    witnessSignatureUrl:  witnessUrl  || null,
    notes:               comp.notes as string | null ?? null,
  }
}

// ── Stored signed PDF ─────────────────────────────────────────────────────
// The PDF is made in the browser right after submit (from the snapshot via
// getCompletionPdfData) and uploaded here. It is stored once: a completion
// that already has a PDF can't be overwritten. If it couldn't be made or
// uploaded, signed_pdf_error is set and an admin can regenerate it from the
// snapshot. Completions have no UPDATE policy, so these writes use the admin
// client after the checks below.

const MAX_SIGNED_PDF_BYTES = 20 * 1024 * 1024

async function loadCompletionForPdf(completionId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('safety_form_completions')
    .select('id, assignment_id, profile_id, signed_pdf_path')
    .eq('id', completionId)
    .maybeSingle()
  return { admin, completion: data as { id: string; assignment_id: string; profile_id: string; signed_pdf_path: string | null } | null }
}

export async function uploadSignedPdf(formData: FormData): Promise<{ success?: true; error?: string }> {
  const profile = await requireAuth()
  const completionId = formData.get('completion_id') as string
  const file = formData.get('pdf') as File | null

  const { admin, completion } = await loadCompletionForPdf(completionId)
  if (!completion) return { error: 'Completed form not found.' }
  // The signer uploads it at submit; afterwards only an admin can (Regenerate PDF)
  if (completion.profile_id !== profile.id && profile.role !== 'admin') return { error: 'Access denied' }
  if (completion.signed_pdf_path) return { error: 'A signed PDF is already stored for this form.' }

  if (!file || file.size === 0) return { error: 'No PDF received.' }
  if (file.size > MAX_SIGNED_PDF_BYTES) return { error: 'The PDF is too large (over 20 MB).' }
  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return { error: 'The file is not a PDF.' }

  const key = `form-signed-pdfs/${completion.assignment_id}/${completion.id}-${Date.now()}.pdf`
  try {
    await uploadToR2(key, buf, 'application/pdf')
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    await admin.from('safety_form_completions').update({ signed_pdf_error: message.slice(0, 500) })
      .eq('id', completion.id).is('signed_pdf_path', null).select('id')
    return { error: `Could not store the signed PDF: ${message}` }
  }

  // Only fills an empty slot, so two uploads at once can't both win
  const { data: rows, error } = await admin
    .from('safety_form_completions')
    .update({ signed_pdf_path: key, signed_pdf_generated_at: new Date().toISOString(), signed_pdf_error: null })
    .eq('id', completion.id)
    .is('signed_pdf_path', null)
    .select('id')
  if (error || !rows || rows.length === 0) {
    await deleteFromR2(key).catch(() => {})
    return { error: error?.message ?? 'A signed PDF is already stored for this form.' }
  }

  revalidatePath('/safety')
  return { success: true }
}

// Records why the PDF couldn't be made (e.g. the browser failed to render it).
export async function reportSignedPdfError(completionId: string, message: string): Promise<{ success?: true; error?: string }> {
  const profile = await requireAuth()
  const { admin, completion } = await loadCompletionForPdf(completionId)
  if (!completion) return { error: 'Completed form not found.' }
  if (completion.profile_id !== profile.id && profile.role !== 'admin') return { error: 'Access denied' }
  if (completion.signed_pdf_path) return { success: true }

  const { error } = await admin
    .from('safety_form_completions')
    .update({ signed_pdf_error: (message || 'PDF could not be generated').slice(0, 500) })
    .eq('id', completion.id)
    .is('signed_pdf_path', null)
    .select('id')
  if (error) return { error: error.message }
  revalidatePath('/safety')
  return { success: true }
}

// Download link for the stored signed PDF. Never builds a new one.
export async function getSignedPdfUrl(assignmentId: string): Promise<{ url?: string; error?: string }> {
  const profile = await requireAuth()
  const admin   = createAdminClient()

  const { data: asgn } = await admin
    .from('safety_form_assignments')
    .select('id, assigned_to, profiles!assigned_to (first_name, last_name)')
    .eq('id', assignmentId)
    .maybeSingle()
  if (!asgn) return { error: 'Assignment not found' }
  if (ROLE_LEVEL[profile.role] < ROLE_LEVEL['supervisor'] && asgn.assigned_to !== profile.id) {
    return { error: 'Access denied' }
  }

  const { data: comp } = await admin
    .from('safety_form_completions')
    .select('signed_pdf_path, signed_pdf_error, completed_at, template_title_snapshot')
    .eq('assignment_id', assignmentId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!comp) return { error: 'Completion record not found' }
  if (!comp.signed_pdf_path) {
    return { error: comp.signed_pdf_error ? `No signed PDF stored: ${comp.signed_pdf_error}` : 'No signed PDF stored for this form yet.' }
  }

  const worker = (Array.isArray(asgn.profiles) ? asgn.profiles[0] : asgn.profiles) as { first_name: string; last_name: string } | null
  const perthDate = new Date(comp.completed_at as string).toLocaleDateString('en-CA', { timeZone: 'Australia/Perth' })
  const name = `${comp.template_title_snapshot ?? 'Form'} - ${worker ? `${worker.first_name} ${worker.last_name}`.trim() : 'worker'} - ${perthDate}.pdf`
  try {
    return { url: await getR2SignedUrl(comp.signed_pdf_path as string, 300, name) }
  } catch {
    return { error: 'Could not create a download link. Please try again.' }
  }
}

// ── Site Reference Documents ───────────────────────────────────────────────
// Uploaded PDFs with no signatures, per site. Managed in Safety Admin by
// admins (RLS srd_admin); read-only for all staff, including on the site page.

const MAX_REFERENCE_PDF_BYTES = 20 * 1024 * 1024

export async function uploadReferenceDoc(formData: FormData): Promise<{ success?: true; error?: string }> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const title  = ((formData.get('title') as string) ?? '').trim()
  const siteId = (formData.get('site_id') as string) || ''
  const file   = formData.get('file') as File | null
  if (!title)  return { error: 'Title is required.' }
  if (!siteId) return { error: 'Select a site.' }
  if (!file || file.size === 0) return { error: 'Choose a PDF to upload.' }
  if (file.size > MAX_REFERENCE_PDF_BYTES) return { error: 'The PDF is too large (max 20 MB).' }

  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return { error: 'The file must be a PDF.' }

  const key = `safety-reference-docs/${siteId}/${crypto.randomUUID()}.pdf`
  try {
    await uploadToR2(key, buf, 'application/pdf')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('safety_reference_documents')
    .insert({ title, site_id: siteId, file_path: key, file_name: file.name, uploaded_by: profile.id })
    .select('id')
    .single()
  if (error) {
    await deleteFromR2(key).catch(() => {})
    return { error: error.message }
  }

  revalidatePath('/safety')
  revalidatePath(`/sites/${siteId}`)
  return { success: true }
}

export async function getReferenceDocUrl(id: string): Promise<{ url?: string; error?: string }> {
  await requireAuth()
  const supabase = await createClient()
  const { data } = await supabase
    .from('safety_reference_documents')
    .select('file_path, file_name, title')
    .eq('id', id)
    .maybeSingle()
  if (!data?.file_path) return { error: 'Document not found.' }
  try {
    return { url: await getR2SignedUrl(data.file_path, 300, data.file_name || `${data.title}.pdf`) }
  } catch {
    return { error: 'Could not create a download link. Please try again.' }
  }
}

export async function deleteReferenceDoc(id: string, siteId: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('safety_reference_documents')
    .delete()
    .eq('id', id)
    .select('id, file_path')

  if (error) return { error: error.message }
  if (!rows || rows.length === 0) return { error: 'Document not found, or you do not have permission to delete it.' }
  const filePath = (rows[0] as { file_path: string | null }).file_path
  if (filePath) await deleteFromR2(filePath).catch(() => {})

  revalidatePath('/safety')
  revalidatePath(`/sites/${siteId}`)
  return { success: true }
}
