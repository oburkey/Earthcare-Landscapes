// Shared Files-page types and constants. Plain module (no 'use server') so
// both the server query and client components can import from it.

export const FILES_PAGE_SIZE = 40

export type FileKind = 'photo' | 'document'

// Matches files_index.source (see supabase/migration_site_files.sql)
export type FileSource = 'lot_photo' | 'extra_job_photo' | 'lot_document' | 'site_plan' | 'site_file'

export type FileFilters = {
  siteId?: string
  stageId?: string
  lotId?: string
  kind?: FileKind
  // Perth-local calendar dates, YYYY-MM-DD (inclusive)
  from?: string
  to?: string
  search?: string
}

export type FileItem = {
  id: string
  source: FileSource
  kind: FileKind
  url: string
  isPdf: boolean
  fileName: string | null
  notes: string | null
  uploadedBy: string | null
  uploaderName: string | null
  createdAt: string
  siteId: string
  siteName: string | null
  stageId: string | null
  stageName: string | null
  lotId: string | null
  lotNumber: string | null
  extraJobId: string | null
  extraJobTitle: string | null
}

export type FilesPage = { items: FileItem[]; hasMore: boolean; error?: string }

export type FilterTreeSite = {
  id: string
  name: string
  stages: { id: string; name: string; lots: { id: string; lotNumber: string }[] }[]
}

export const SOURCE_LABELS: Record<FileSource, string> = {
  lot_photo:       'Lot photo',
  extra_job_photo: 'Extra job photo',
  lot_document:    'Lot document',
  site_plan:       'Site plan',
  site_file:       'Site upload',
}
