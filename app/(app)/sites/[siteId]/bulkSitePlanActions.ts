'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'
import { uploadToR2 } from '@/lib/r2'
import type { MatchableLot } from './bulkSitePlanParser'

// Matching pool spans every active site, not just the one the bulk-upload
// panel was opened from — a single batch commonly mixes filenames from
// several developments (different prefixes), and filenames carry their own
// site identifier, so there's no reason to restrict the match candidates.
export async function getLotsForBulkMatch(): Promise<MatchableLot[]> {
  const profile = await requireAuth()
  if (profile.role !== 'admin') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sites')
    .select(`
      id, name, completed_at,
      stages(id, name, completed_at,
        lots(id, lot_number, home_design)
      )
    `)
    .is('completed_at', null)
    .order('name')

  if (error || !data) return []

  const lots: MatchableLot[] = []
  for (const site of data) {
    for (const stage of site.stages ?? []) {
      if (stage.completed_at) continue
      for (const lot of stage.lots ?? []) {
        lots.push({
          id:         lot.id,
          lotNumber:  lot.lot_number,
          siteId:     site.id,
          siteName:   site.name,
          stageId:    stage.id,
          stageName:  stage.name,
          homeDesign: lot.home_design ?? null,
        })
      }
    }
  }
  return lots
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

  const supabase = await createClient()
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

    const { ext, contentType } = extAndContentType(file)
    const key = `lot-documents/${lotId}/${crypto.randomUUID()}.${ext}`
    const documentName = file.name.replace(/\.[^/.]+$/, '')

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      await uploadToR2(key, buffer, contentType)
    } catch (e) {
      errors.push({ filename, error: e instanceof Error ? e.message : 'Upload failed.' })
      continue
    }

    const { error: dbError } = await supabase.from('lot_documents').insert({
      lot_id:        lotId,
      storage_path:  key,
      document_name: documentName,
      document_type: 'site_plan',
      uploaded_by:   profile.id,
    })
    if (dbError) {
      errors.push({ filename, error: dbError.message })
      continue
    }

    const updateHomeDesign = formData.get(`update_home_design_${i}`) === 'true'
    const homeDesign = (formData.get(`home_design_${i}`) as string)?.trim() || null
    if (updateHomeDesign && homeDesign) {
      const { error: hdError } = await supabase
        .from('lots')
        .update({ home_design: homeDesign })
        .eq('id', lotId)
      if (hdError) errors.push({ filename, error: `Uploaded, but failed to update home design: ${hdError.message}` })
    }

    imported++
    touchedLotPaths.add(`/sites/${siteId}/stages/${stageId}/lots/${lotId}`)
  }

  for (const path of touchedLotPaths) revalidatePath(path)
  revalidateTag('schedule')
  revalidateTag('stages')

  return { imported, errors }
}
