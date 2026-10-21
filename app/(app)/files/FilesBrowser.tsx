'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import PhotoUpload from '@/app/_components/PhotoUpload'
import { loadFilesPage, uploadSiteFile, deleteSiteFile } from './actions'
import { SOURCE_LABELS, type FileFilters, type FileItem, type FileKind, type FilesPage, type FilterTreeSite } from './types'

interface Props {
  tree: FilterTreeSite[]
  initial: FilesPage
  // Set on a site's Files tab — the site filter is fixed to this site.
  lockedSiteId?: string
  currentUserId: string
  isAdmin: boolean
}

const SELECT = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50'

function formatPerth(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
}

function lotHref(item: FileItem): string | null {
  if (!item.lotId || !item.stageId) return null
  return `/sites/${item.siteId}/stages/${item.stageId}/lots/${item.lotId}`
}

function extraJobHref(item: FileItem): string | null {
  if (!item.extraJobId || !item.stageId) return null
  return `/sites/${item.siteId}/stages/${item.stageId}/extra-jobs/${item.extraJobId}`
}

// "Site · Stage · Lot 12" or "Site · Stage · Extra job: Title"
function LinkedTo({ item, hideSite }: { item: FileItem; hideSite: boolean }) {
  const parts: React.ReactNode[] = []
  if (!hideSite) parts.push(<Link key="site" href={`/sites/${item.siteId}`} className="hover:underline">{item.siteName ?? 'Site'}</Link>)
  if (item.stageId) parts.push(
    <Link key="stage" href={`/sites/${item.siteId}/stages/${item.stageId}`} className="hover:underline">{item.stageName ?? 'Stage'}</Link>
  )
  const lh = lotHref(item)
  if (lh) parts.push(<Link key="lot" href={lh} className="hover:underline">Lot {item.lotNumber ?? '?'}</Link>)
  const jh = extraJobHref(item)
  if (jh) parts.push(<Link key="job" href={jh} className="hover:underline">Extra job: {item.extraJobTitle ?? 'Untitled'}</Link>)
  if (parts.length === 0) parts.push(<span key="site-level">Site-level</span>)
  return (
    <span>
      {parts.map((p, i) => <span key={i}>{i > 0 && ' · '}{p}</span>)}
    </span>
  )
}

type FilterState = {
  siteId: string
  stageId: string
  lotId: string
  kind: FileKind | ''
  from: string
  to: string
  search: string
}

const EMPTY_FILTERS: FilterState = { siteId: '', stageId: '', lotId: '', kind: '', from: '', to: '', search: '' }

function toQuery(f: FilterState): FileFilters {
  return {
    siteId: f.siteId || undefined,
    stageId: f.stageId || undefined,
    lotId: f.lotId || undefined,
    kind: f.kind || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    search: f.search || undefined,
  }
}

export default function FilesBrowser({ tree, initial, lockedSiteId, currentUserId, isAdmin }: Props) {
  const [f, setF] = useState<FilterState>({ ...EMPTY_FILTERS, siteId: lockedSiteId ?? '' })
  const [searchInput, setSearchInput] = useState('')
  const { siteId, stageId, lotId, kind, from, to, search } = f

  const [items, setItems]     = useState<FileItem[]>(initial.items)
  const [hasMore, setHasMore] = useState(initial.hasMore)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(initial.error ?? null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [showUpload, setShowUpload] = useState(false)
  const [upSiteId, setUpSiteId]     = useState(lockedSiteId ?? '')
  const [upStageId, setUpStageId]   = useState('')
  const [upLotId, setUpLotId]       = useState('')

  // Ignore responses from superseded requests (fast filter changes).
  const requestSeq = useRef(0)
  // Latest filters, readable from the debounced search timeout.
  const filtersRef = useRef(f)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const site  = tree.find((s) => s.id === siteId)
  const stage = site?.stages.find((st) => st.id === stageId)
  const upSite  = tree.find((s) => s.id === upSiteId)
  const upStage = upSite?.stages.find((st) => st.id === upStageId)

  const filters = toQuery(f)

  // Loads the first page for the given filters, replacing the list.
  function reload(next: FilterState) {
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    loadFilesPage(toQuery(next), 0)
      .then((page) => {
        if (seq !== requestSeq.current) return
        setItems(page.items)
        setHasMore(page.hasMore)
        if (page.error) setError(page.error)
      })
      .catch(() => { if (seq === requestSeq.current) setError('Failed to load files.') })
      .finally(() => { if (seq === requestSeq.current) setLoading(false) })
  }

  // Every filter change goes through here: update state, then reload.
  function applyFilters(patch: Partial<FilterState>) {
    const next = { ...filtersRef.current, ...patch }
    filtersRef.current = next
    setF(next)
    reload(next)
  }

  function handleSearchInput(value: string) {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      if (value.trim() !== filtersRef.current.search) applyFilters({ search: value.trim() })
    }, 300)
  }

  function loadMore() {
    const seq = ++requestSeq.current
    setLoading(true)
    loadFilesPage(filters, items.length)
      .then((page) => {
        if (seq !== requestSeq.current) return
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id))
          return [...prev, ...page.items.filter((i) => !seen.has(i.id))]
        })
        setHasMore(page.hasMore)
        if (page.error) setError(page.error)
      })
      .catch(() => { if (seq === requestSeq.current) setError('Failed to load more files.') })
      .finally(() => { if (seq === requestSeq.current) setLoading(false) })
  }

  async function handleDelete(item: FileItem) {
    if (!confirm(`Delete "${item.fileName ?? 'this file'}"? This can't be undone.`)) return
    setDeleting(item.id)
    const result = await deleteSiteFile(item.id)
    setDeleting(null)
    if (result?.error) { setError(result.error); return }
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  function canDelete(item: FileItem): boolean {
    return item.source === 'site_file' && (isAdmin || item.uploadedBy === currentUserId)
  }

  function resetFilters() {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setSearchInput('')
    applyFilters({ ...EMPTY_FILTERS, siteId: lockedSiteId ?? '' })
  }

  const photos = items.filter((i) => i.kind === 'photo')
  const docs   = items.filter((i) => i.kind === 'document')
  const hasActiveFilters = (!lockedSiteId && !!siteId) || !!stageId || !!lotId || !!kind || !!from || !!to || !!search

  const uploadBlocked = !upSiteId ? 'Choose a site to upload to.' : null

  return (
    <div className="space-y-4">

      {/* ── Upload (collapsed by default) ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowUpload((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-fg-secondary hover:bg-surface-raised"
        >
          <svg className={`h-4 w-4 text-fg-muted transition-transform ${showUpload ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          Upload files
        </button>
        {showUpload && (
          <div className="border-t border-border-subtle p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-1">Site <span className="text-red-500">*</span></label>
                <select
                  value={upSiteId}
                  disabled={!!lockedSiteId}
                  onChange={(e) => { setUpSiteId(e.target.value); setUpStageId(''); setUpLotId('') }}
                  className={SELECT}
                >
                  <option value="">Choose site…</option>
                  {tree.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-1">Stage <span className="font-normal text-fg-muted">(optional)</span></label>
                <select
                  value={upStageId}
                  disabled={!upSite}
                  onChange={(e) => { setUpStageId(e.target.value); setUpLotId('') }}
                  className={SELECT}
                >
                  <option value="">No stage</option>
                  {upSite?.stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-1">Lot <span className="font-normal text-fg-muted">(optional)</span></label>
                <select
                  value={upLotId}
                  disabled={!upStage}
                  onChange={(e) => setUpLotId(e.target.value)}
                  className={SELECT}
                >
                  <option value="">No lot</option>
                  {upStage?.lots.map((l) => <option key={l.id} value={l.id}>Lot {l.lotNumber}</option>)}
                </select>
              </div>
            </div>
            <PhotoUpload
              mode="file"
              action={uploadSiteFile}
              hiddenFields={{ site_id: upSiteId, stage_id: upStageId, lot_id: upLotId }}
              blockedReason={uploadBlocked}
              onUploaded={() => reload(filtersRef.current)}
            />
          </div>
        )}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          {!lockedSiteId && (
            <select
              value={siteId}
              onChange={(e) => applyFilters({ siteId: e.target.value, stageId: '', lotId: '' })}
              className={SELECT}
              aria-label="Site"
            >
              <option value="">All sites</option>
              {tree.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select
            value={stageId}
            disabled={!site}
            onChange={(e) => applyFilters({ stageId: e.target.value, lotId: '' })}
            className={SELECT}
            aria-label="Stage"
          >
            <option value="">All stages</option>
            {site?.stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
          <select
            value={lotId}
            disabled={!stage}
            onChange={(e) => applyFilters({ lotId: e.target.value })}
            className={SELECT}
            aria-label="Lot"
          >
            <option value="">All lots</option>
            {stage?.lots.map((l) => <option key={l.id} value={l.id}>Lot {l.lotNumber}</option>)}
          </select>
          <select value={kind} onChange={(e) => applyFilters({ kind: e.target.value as FileKind | '' })} className={SELECT} aria-label="Type">
            <option value="">Photos &amp; documents</option>
            <option value="photo">Photos</option>
            <option value="document">Documents</option>
          </select>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input type="date" value={from} max={to || undefined} onChange={(e) => applyFilters({ from: e.target.value })} className={SELECT} aria-label="From date" />
            <span className="text-xs text-fg-muted shrink-0">to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => applyFilters({ to: e.target.value })} className={SELECT} aria-label="To date" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search notes or file name…"
            className={`${SELECT} flex-1`}
          />
          {hasActiveFilters && (
            <button type="button" onClick={resetFilters} className="shrink-0 text-sm font-medium text-fg-muted hover:text-fg-secondary">
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{error}</p>
      )}

      {items.length === 0 && !loading && (
        <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
          <p className="text-sm text-fg-muted">{hasActiveFilters ? 'No files match these filters.' : 'No files yet.'}</p>
        </div>
      )}

      {/* ── Photos ────────────────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">
            Photos <span className="font-normal text-fg-muted text-sm">({photos.length}{hasMore ? '+' : ''})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((item) => (
              <div key={item.id} className="space-y-1 min-w-0">
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden bg-surface-raised">
                  {item.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.notes ?? item.fileName ?? 'Photo'} loading="lazy"
                      className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                  )}
                </a>
                {item.notes && <p className="text-xs text-fg-secondary line-clamp-2" title={item.notes}>{item.notes}</p>}
                <p className="text-xs text-fg-muted truncate"><LinkedTo item={item} hideSite={!!lockedSiteId} /></p>
                <p className="text-xs text-fg-muted truncate">
                  {item.uploaderName ?? 'Unknown'} · {formatPerth(item.createdAt)}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-fg-muted">{SOURCE_LABELS[item.source]}</span>
                  {canDelete(item) && (
                    <button type="button" onClick={() => handleDelete(item)} disabled={deleting === item.id}
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                      {deleting === item.id ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Documents ─────────────────────────────────────────────────────── */}
      {docs.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-fg-secondary mb-3">
            Documents <span className="font-normal text-fg-muted text-sm">({docs.length}{hasMore ? '+' : ''})</span>
          </h2>
          <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
            {docs.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-raised overflow-hidden text-[10px] font-bold text-red-600">
                  {item.isPdf || !item.url ? 'PDF' : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </a>
                <div className="min-w-0 flex-1">
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="block text-sm font-medium text-fg hover:underline truncate">
                    {item.fileName ?? 'Untitled document'}
                  </a>
                  {item.notes && <p className="text-xs text-fg-secondary">{item.notes}</p>}
                  <p className="text-xs text-fg-muted"><LinkedTo item={item} hideSite={!!lockedSiteId} /></p>
                  <p className="text-xs text-fg-muted">
                    {SOURCE_LABELS[item.source]} · {item.uploaderName ?? 'Unknown'} · {formatPerth(item.createdAt)}
                  </p>
                </div>
                {canDelete(item) && (
                  <button type="button" onClick={() => handleDelete(item)} disabled={deleting === item.id}
                    className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50">
                    {deleting === item.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(hasMore || loading) && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
