'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { uploadToR2, deleteFromR2 } from '@/lib/r2'
import type { ActionState } from '@/types/actions'
import { fetchFilesPage } from './queries'
import type { FileFilters, FilesPage } from './types'

const INTERNAL_ROLES = ['worker', 'leading_hand', 'supervisor', 'admin']

export async function loadFilesPage(filters: FileFilters, offset: number): Promise<FilesPage> {
  const profile = await requireAuth()
  if (!INTERNAL_ROLES.includes(profile.role)) return { items: [], hasMore: false, error: 'Not allowed.' }
  return fetchFilesPage(filters, Math.max(0, Math.floor(offset) || 0))
}

// Single-file upload — PhotoUpload (mode="file") calls this once per file.
// Site required; stage and lot optional but must belong to the chosen site/stage.
export async function uploadSiteFile(formData: FormData): Promise<ActionState> {
  const profile = await requireAuth()
  if (!INTERNAL_ROLES.includes(profile.role)) return { error: 'You do not have permission to upload files.' }

  const siteId  = (formData.get('site_id') as string) || ''
  const stageId = (formData.get('stage_id') as string) || null
  const lotId   = (formData.get('lot_id') as string) || null
  const notes   = (formData.get('notes') as string)?.trim() || null
  const file    = formData.get('photo') as File | null

  if (!siteId) return { error: 'Choose a site.' }
  if (lotId && !stageId) return { error: 'Choose a stage for this lot.' }
  if (!file || file.size === 0) return { error: 'No file selected.' }

  // iOS can report an empty/odd MIME type for PDFs — trust the extension too
  // (same approach as uploadLotDocument).
  const isPdf   = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isImage = !isPdf && file.type.startsWith('image/')
  if (!isPdf && !isImage) return { error: 'File must be a photo or a PDF.' }
  if (isPdf && file.size > 20 * 1024 * 1024)   return { error: 'PDF too large (max 20 MB).' }
  if (isImage && file.size > 10 * 1024 * 1024) return { error: 'Photo too large (max 10 MB).' }

  const supabase = await createClient()

  // Validate the site/stage/lot chain so a file can't be linked inconsistently.
  if (stageId) {
    const { data: stage } = await supabase.from('stages').select('id').eq('id', stageId).eq('site_id', siteId).maybeSingle()
    if (!stage) return { error: 'That stage does not belong to the selected site.' }
  }
  if (lotId) {
    const { data: lot } = await supabase.from('lots').select('id').eq('id', lotId).eq('stage_id', stageId!).maybeSingle()
    if (!lot) return { error: 'That lot does not belong to the selected stage.' }
  }

  const key = `site-files/${siteId}/${crypto.randomUUID()}.${isPdf ? 'pdf' : 'jpg'}`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, isPdf ? 'application/pdf' : file.type)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }

  const { error: dbError } = await supabase.from('site_files').insert({
    site_id:      siteId,
    stage_id:     stageId,
    lot_id:       lotId,
    storage_path: key,
    file_name:    file.name.slice(0, 200) || (isPdf ? 'document.pdf' : 'photo.jpg'),
    file_type:    isPdf ? 'pdf' : 'photo',
    notes,
    uploaded_by:  profile.id,
  })

  if (dbError) {
    await deleteFromR2(key).catch(() => null)
    return { error: dbError.message }
  }

  revalidatePath('/files')
  revalidatePath(`/sites/${siteId}`)
  return null
}

// Only site_files can be deleted from the Files page — existing lot/extra job
// photos and documents keep their own delete rules on their own pages.
export async function deleteSiteFile(fileId: string): Promise<ActionState> {
  const profile = await requireAuth()
  if (!INTERNAL_ROLES.includes(profile.role)) return { error: 'Not allowed.' }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('site_files')
    .select('id, site_id, storage_path, uploaded_by')
    .eq('id', fileId)
    .maybeSingle()
  if (!row) return { error: 'File not found.' }
  if (profile.role !== 'admin' && row.uploaded_by !== profile.id) {
    return { error: 'You can only delete files you uploaded.' }
  }

  // Delete the row first (RLS re-checks permission); only then remove the
  // object, so a refused delete never orphans the DB row.
  const { data: deleted, error } = await supabase.from('site_files').delete().eq('id', fileId).select('id')
  if (error) return { error: error.message }
  if (!deleted || deleted.length === 0) return { error: 'Delete failed — you may not have permission.' }

  await deleteFromR2(row.storage_path).catch(() => null)

  revalidatePath('/files')
  revalidatePath(`/sites/${row.site_id}`)
  return null
}
