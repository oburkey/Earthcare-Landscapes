'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
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
  const { error } = await supabase
    .from('safety_form_templates')
    .update(data)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/safety')
  return { success: true }
}

export async function setTemplateActive(id: string, isActive: boolean) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('safety_form_templates')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { error: error.message }
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

  const { error } = await supabase
    .from('safety_form_assignments')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
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

  const { error: insertError } = await supabase
    .from('safety_form_completions')
    .insert({
      assignment_id:           assignmentId,
      profile_id:              profile.id,
      responses,
      inductee_signature_path: inducteeSignaturePath,
      witness_signature_path:  witnessSignaturePath,
      completed_at:            now,
      notes,
    })

  if (insertError) {
    if (inducteeSignaturePath) await deleteFromR2(inducteeSignaturePath).catch(() => {})
    if (witnessSignaturePath)  await deleteFromR2(witnessSignaturePath).catch(() => {})
    return { error: insertError.message }
  }

  // Mark assignment complete (bypasses RLS — worker has no UPDATE on assignments)
  await admin
    .from('safety_form_assignments')
    .update({ completed_at: now })
    .eq('id', assignmentId)

  revalidatePath('/safety')
  return { success: true }
}

// ── Site Reference Documents ───────────────────────────────────────────────

export async function createReferenceDoc(data: {
  title: string
  site_id: string
  template_id: string | null
  content_html: string
}) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('safety_reference_documents')
    .insert({ ...data, uploaded_by: profile.id })
    .select('id, title, site_id, template_id, content_html, uploaded_by, created_at, updated_at')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/sites/${data.site_id}`)
  return { success: true, doc: row }
}

export async function updateReferenceDoc(id: string, data: {
  title: string
  content_html: string
  site_id: string
}) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('safety_reference_documents')
    .update({ title: data.title, content_html: data.content_html })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/sites/${data.site_id}`)
  return { success: true }
}

export async function deleteReferenceDoc(id: string, siteId: string) {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { error: 'Admin access required' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('safety_reference_documents')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/sites/${siteId}`)
  return { success: true }
}
