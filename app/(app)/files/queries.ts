// Server-only Files page query — reads one page of files_index (see
// supabase/migration_site_files.sql), then resolves names and signed URLs.
// Called by the page (first page) and by the loadFilesPage server action
// (filter changes / "Load more").

import { createClient } from '@/lib/supabase/server'
import { getR2SignedUrlSafe } from '@/lib/r2'
import { FILES_PAGE_SIZE, type FileFilters, type FileItem, type FilesPage, type FileKind, type FileSource } from './types'

type IndexRow = {
  id: string
  source: FileSource
  kind: FileKind
  site_id: string
  stage_id: string | null
  lot_id: string | null
  extra_job_id: string | null
  storage_path: string
  file_name: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// PostgREST `or=` filters are comma/paren delimited and ilike uses % and _ —
// strip anything that could break out of the pattern.
function sanitizeSearch(q: string): string {
  return q.replace(/[,()%_*\\:"']/g, ' ').trim().slice(0, 100)
}

function uniq(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))]
}

export async function fetchFilesPage(filters: FileFilters, offset: number): Promise<FilesPage> {
  const supabase = await createClient()

  let query = supabase
    .from('files_index')
    .select('id, source, kind, site_id, stage_id, lot_id, extra_job_id, storage_path, file_name, notes, uploaded_by, created_at')

  if (filters.lotId)        query = query.eq('lot_id', filters.lotId)
  else if (filters.stageId) query = query.eq('stage_id', filters.stageId)
  else if (filters.siteId)  query = query.eq('site_id', filters.siteId)
  if (filters.kind) query = query.eq('kind', filters.kind)
  // Perth is UTC+8 year-round (no DST), so a fixed offset is exact.
  if (filters.from && DATE_RE.test(filters.from)) query = query.gte('created_at', `${filters.from}T00:00:00+08:00`)
  if (filters.to   && DATE_RE.test(filters.to))   query = query.lte('created_at', `${filters.to}T23:59:59.999+08:00`)
  const search = filters.search ? sanitizeSearch(filters.search) : ''
  if (search) query = query.or(`file_name.ilike.%${search}%,notes.ilike.%${search}%`)

  // Fetch one extra row to know whether there's another page.
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + FILES_PAGE_SIZE)

  if (error) return { items: [], hasMore: false, error: error.message }

  const rows = (data ?? []) as IndexRow[]
  const hasMore = rows.length > FILES_PAGE_SIZE
  const pageRows = rows.slice(0, FILES_PAGE_SIZE)
  if (pageRows.length === 0) return { items: [], hasMore: false }

  const siteIds     = uniq(pageRows.map((r) => r.site_id))
  const stageIds    = uniq(pageRows.map((r) => r.stage_id))
  const lotIds      = uniq(pageRows.map((r) => r.lot_id))
  const extraJobIds = uniq(pageRows.map((r) => r.extra_job_id))
  const profileIds  = uniq(pageRows.map((r) => r.uploaded_by))

  const empty = Promise.resolve({ data: [] as never[] })
  const [sites, stages, lots, extraJobs, profiles, urls] = await Promise.all([
    siteIds.length     ? supabase.from('sites').select('id, name').in('id', siteIds) : empty,
    stageIds.length    ? supabase.from('stages').select('id, name').in('id', stageIds) : empty,
    lotIds.length      ? supabase.from('lots').select('id, lot_number').in('id', lotIds) : empty,
    extraJobIds.length ? supabase.from('extra_jobs').select('id, title').in('id', extraJobIds) : empty,
    profileIds.length  ? supabase.from('profiles').select('id, first_name, last_name').in('id', profileIds) : empty,
    Promise.all(pageRows.map((r) => getR2SignedUrlSafe(r.storage_path))),
  ])

  const siteName  = new Map((sites.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))
  const stageName = new Map((stages.data ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))
  const lotNumber = new Map((lots.data ?? []).map((l: { id: string; lot_number: string }) => [l.id, l.lot_number]))
  const jobTitle  = new Map((extraJobs.data ?? []).map((j: { id: string; title: string }) => [j.id, j.title]))
  const userName  = new Map((profiles.data ?? []).map((p: { id: string; first_name: string | null; last_name: string | null }) =>
    [p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || null]))

  const items: FileItem[] = pageRows.map((r, i) => ({
    id:            r.id,
    source:        r.source,
    kind:          r.kind,
    url:           urls[i],
    // Site plans are documents stored as JPEGs, so go by extension, not kind.
    isPdf:         /\.pdf$/i.test(r.storage_path),
    fileName:      r.file_name,
    notes:         r.notes,
    uploadedBy:    r.uploaded_by,
    uploaderName:  r.uploaded_by ? (userName.get(r.uploaded_by) ?? null) : null,
    createdAt:     r.created_at,
    siteId:        r.site_id,
    siteName:      siteName.get(r.site_id) ?? null,
    stageId:       r.stage_id,
    stageName:     r.stage_id ? (stageName.get(r.stage_id) ?? null) : null,
    lotId:         r.lot_id,
    lotNumber:     r.lot_id ? (lotNumber.get(r.lot_id) ?? null) : null,
    extraJobId:    r.extra_job_id,
    extraJobTitle: r.extra_job_id ? (jobTitle.get(r.extra_job_id) ?? null) : null,
  }))

  return { items, hasMore }
}
