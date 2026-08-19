'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2 } from '@/lib/r2'
import type { MatchableLot } from './bulkSitePlanParser'

// Matching pool is scoped to a single stage — the bulk upload panel lives
// inside BulkUpdateLotsButton on the stage page, one stage at a time.
export async function getLotsForBulkMatch(stageId: string): Promise<MatchableLot[]> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('lots')
    .select('id, lot_number, home_design, stages!inner(id, name, sites!inner(id, name))')
    .eq('stage_id', stageId)
    .order('lot_number')

  if (error || !data) return []

  return data.map((lot) => {
    const stage = Array.isArray(lot.stages) ? lot.stages[0] : lot.stages as { id: string; name: string; sites: unknown }
    const site = Array.isArray(stage.sites) ? stage.sites[0] : stage.sites as { id: string; name: string }
    return {
      id:         lot.id,
      lotNumber:  lot.lot_number,
      siteId:     site.id,
      siteName:   site.name,
      stageId:    stage.id,
      stageName:  stage.name,
      homeDesign: lot.home_design ?? null,
    }
  })
}

const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']

// Mirrors the extension-first validation used for the single-file lot
// document uploader — File.type is unreliable across devices (notably iOS),
// so the filename extension is the primary signal, not just a fallback.
function isAcceptableFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ACCEPTED_EXTENSIONS.includes(ext)) return true
  return file.type === 'application/pdf' || file.type.startsWith('image/')
}

function extAndContentType(file: File): { ext: string; contentType: string } {
  const nameExt = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (nameExt === 'pdf' || file.type === 'application/pdf') return { ext: 'pdf', contentType: 'application/pdf' }
  if (nameExt === 'jpg' || nameExt === 'jpeg' || file.type === 'image/jpeg') return { ext: 'jpg', contentType: 'image/jpeg' }
  if (nameExt === 'png' || file.type === 'image/png') return { ext: 'png', contentType: 'image/png' }
  if (nameExt === 'heic' || nameExt === 'heif') return { ext: nameExt, contentType: file.type || 'image/heic' }
  if (ACCEPTED_EXTENSIONS.includes(nameExt)) return { ext: nameExt, contentType: file.type || 'application/octet-stream' }
  return { ext: 'pdf', contentType: 'application/pdf' }
}

export type BulkImportResult = {
  imported: number
  errors: Array<{ filename: string; error: string }>
}

// Each row is uploaded and inserted independently — one bad file (wrong
// type, DB error) shouldn't abort the rest of a large batch. Row i's fields
// are read as file_i / lot_id_i / ... so the client can post an arbitrary
// number of rows as plain FormData (Files can't be JSON-encoded).
export async function importBulkSitePlans(formData: FormData): Promise<BulkImportResult> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return { imported: 0, errors: [{ filename: '', error: 'Only admins can bulk import site plans.' }] }

  const count = parseInt((formData.get('count') as string) ?? '0', 10)
  if (!count || count <= 0) return { imported: 0, errors: [] }

  // Service-role client, not the session-bound one — this action is already
  // fully gated to admin above, so bypassing RLS here just removes it as a
  // possible point of failure for a write that's already been authorized in
  // application code. Same pattern as materials/stock-deduction.ts's
  // applyStockDelta.
  const supabase = createAdminClient()
  const errors: Array<{ filename: string; error: string }> = []
  let imported = 0

  // Paths whose lots got a plan added — revalidated once at the end rather
  // than per row.
  const touchedLotPaths = new Set<string>()

  for (let i = 0; i < count; i++) {
    const file   = formData.get(`file_${i}`) as File | null
    const lotId  = formData.get(`lot_id_${i}`) as string | null
    const siteId = formData.get(`site_id_${i}`) as string | null
    const stageId = formData.get(`stage_id_${i}`) as string | null
    const filename = file?.name ?? `row ${i + 1}`

    if (!file || file.size === 0 || !lotId || !siteId || !stageId) continue // unmatched row — nothing to import

    if (file.size > 20 * 1024 * 1024) {
      errors.push({ filename, error: 'File too large (max 20 MB).' })
      continue
    }
    if (!isAcceptableFile(file)) {
      errors.push({ filename, error: 'File must be a PDF or image.' })
      continue
    }

    // Whole row wrapped in one try/catch (upload + both DB writes) so any
    // thrown error — R2, Supabase, or otherwise — is logged and turned into
    // a per-row error instead of crashing the whole action (which previously
    // surfaced to the browser as the generic "Something went wrong" page).
    try {
      const { ext, contentType } = extAndContentType(file)
      const key = `lot-documents/${lotId}/${crypto.randomUUID()}.${ext}`
      const documentName = file.name.replace(/\.[^/.]+$/, '')

      const buffer = Buffer.from(await file.arrayBuffer())
      await uploadToR2(key, buffer, contentType)

      const { error: dbError } = await supabase.from('lot_documents').insert({
        lot_id:        lotId,
        storage_path:  key,
        document_name: documentName,
        document_type: 'site_plan',
        uploaded_by:   profile.id,
      })
      if (dbError) {
        console.error('[bulkSitePlanActions] lot_documents insert failed', { filename, lotId, dbError })
        errors.push({ filename, error: dbError.message })
        continue
      }

      const updateHomeDesign = formData.get(`update_home_design_${i}`) === 'true'
      const homeDesign = (formData.get(`home_design_${i}`) as string)?.trim() || null
      if (updateHomeDesign && homeDesign) {
        const { error: hdError } = await supabase
          .from('lots')
          .update({ home_design: homeDesign, updated_by: profile.id })
          .eq('id', lotId)
        if (hdError) {
          console.error('[bulkSitePlanActions] home design update failed', { filename, lotId, hdError })
          errors.push({ filename, error: `Uploaded, but failed to update home design: ${hdError.message}` })
        }
      }

      imported++
      touchedLotPaths.add(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
    } catch (e) {
      console.error('[bulkSitePlanActions] importBulkSitePlans row failed', { filename, lotId, error: e })
      errors.push({ filename, error: e instanceof Error ? e.message : 'Unexpected error during import.' })
    }
  }

  for (const path of touchedLotPaths) revalidatePath(path)
  revalidateTag('schedule')
  revalidateTag('stages')

  return { imported, errors }
}
