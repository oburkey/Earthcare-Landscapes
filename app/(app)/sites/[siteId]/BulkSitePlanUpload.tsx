'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getLotsForBulkMatch, importBulkSitePlans, type BulkImportResult } from './bulkSitePlanActions'
import { matchFilenameToLot, type MatchableLot } from './bulkSitePlanParser'

type Row = {
  file: File
  filename: string
  parsedLotNumber: number | null
  parsedHomeDesign: string | null
  matchedLotId: string | null
  status: 'ready' | 'no_match'
  updateHomeDesign: boolean
  error: string | null
  importedAt: string | null
}

const ACCEPT = 'application/pdf,.pdf,image/*'

function rowKey(row: Row, i: number): string {
  return `${row.filename}-${row.file.size}-${i}`
}

function formatAddedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BulkSitePlanUpload() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [lots, setLots] = useState<MatchableLot[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [importing, startImporting] = useTransition()
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function loadLotsIfNeeded() {
    if (lots.length > 0 || lotsLoading) return
    setLotsLoading(true)
    getLotsForBulkMatch().then((data) => {
      setLots(data)
      setLotsLoading(false)
    })
  }

  const lotsBySite = useMemo(() => {
    const map = new Map<string, MatchableLot[]>()
    for (const lot of lots) {
      const list = map.get(lot.siteName) ?? []
      list.push(lot)
      map.set(lot.siteName, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true }))
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [lots])

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    const newRows: Row[] = files.map((file) => {
      const match = matchFilenameToLot(file.name, lots)
      return {
        file,
        filename: file.name,
        parsedLotNumber: match.parsedLotNumber,
        parsedHomeDesign: match.parsedHomeDesign,
        matchedLotId: match.matchedLotId,
        status: match.status,
        updateHomeDesign: false,
        error: null,
        importedAt: null,
      }
    })
    setRows((prev) => [...prev, ...newRows])
    setResult(null)
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function setRowMatchedLot(index: number, lotId: string | null) {
    setRows((prev) => prev.map((r, i) => i === index
      ? { ...r, matchedLotId: lotId, status: lotId ? 'ready' : 'no_match', error: null }
      : r
    ))
  }

  function setRowUpdateHomeDesign(index: number, value: boolean) {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, updateHomeDesign: value } : r))
  }

  function checkAllHomeDesigns(value: boolean) {
    setRows((prev) => prev.map((r) => (r.parsedHomeDesign && r.matchedLotId) ? { ...r, updateHomeDesign: value } : r))
  }

  const readyCount = rows.filter((r) => r.matchedLotId && !r.importedAt).length
  const anyParsedHomeDesign = rows.some((r) => r.parsedHomeDesign && r.matchedLotId && !r.importedAt)

  function handleImport() {
    const readyRows = rows.filter((r) => r.matchedLotId && !r.importedAt)
    if (readyRows.length === 0) return

    const fd = new FormData()
    fd.set('count', String(readyRows.length))
    readyRows.forEach((row, i) => {
      const lot = lots.find((l) => l.id === row.matchedLotId)
      if (!lot) return
      fd.set(`file_${i}`, row.file)
      fd.set(`lot_id_${i}`, lot.id)
      fd.set(`site_id_${i}`, lot.siteId)
      fd.set(`stage_id_${i}`, lot.stageId)
      fd.set(`update_home_design_${i}`, String(row.updateHomeDesign))
      fd.set(`home_design_${i}`, row.parsedHomeDesign ?? '')
    })

    startImporting(async () => {
      const res = await importBulkSitePlans(fd)
      setResult(res)
      const errorsByFilename = new Map(res.errors.map((e) => [e.filename, e.error]))
      const importedRowFilenames = new Set(readyRows.map((r) => r.filename))
      const now = new Date().toISOString()
      setRows((prev) => prev.map((r) => {
        if (!importedRowFilenames.has(r.filename)) return r
        const rowError = errorsByFilename.get(r.filename) ?? null
        // Row was attempted this round — mark it imported (with today's date)
        // unless it came back in the error list.
        return { ...r, error: rowError, importedAt: rowError ? null : now }
      }))
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); loadLotsIfNeeded() }}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-raised transition-colors"
      >
        <svg className={`h-4 w-4 text-fg-muted shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        <span className="text-sm font-semibold text-fg flex-1">Bulk upload site plans</span>
        {rows.length > 0 && <span className="text-xs text-fg-muted shrink-0">{rows.length} file{rows.length !== 1 ? 's' : ''}</span>}
      </button>

      {open && (
        <div className="border-t border-border-subtle px-5 pb-5 pt-4 space-y-4">
          <p className="text-sm text-fg-muted">
            Files are matched to lots across all sites by filename (e.g. <code className="text-xs">TLB328_KINGFISH_SITE PLAN_Rev 5.pdf</code>).
            Review the matches below before importing — you can correct any row manually.
          </p>

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
            }}
            className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragOver ? 'border-green-600 bg-accent-dim' : 'border-border bg-surface-raised'
            }`}
          >
            <p className="text-sm text-fg-muted mb-3">
              {lotsLoading ? 'Loading lots…' : 'Drag and drop PDF or image files here'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              disabled={lotsLoading}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files)
                e.target.value = ''
              }}
              className="hidden"
            />
            <button
              type="button"
              disabled={lotsLoading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50"
            >
              Choose files
            </button>
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-raised text-fg-muted">
                      <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Filename</th>
                      <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Parsed Lot</th>
                      <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Parsed Design</th>
                      <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Matched Lot</th>
                      <th className="text-left font-medium px-3 py-2 whitespace-nowrap">
                        {anyParsedHomeDesign ? (
                          <span className="inline-flex items-center gap-1.5">
                            Update design?
                            <button type="button" onClick={() => checkAllHomeDesigns(true)} className="text-accent-fg hover:underline font-normal normal-case">all</button>
                            /
                            <button type="button" onClick={() => checkAllHomeDesigns(false)} className="text-accent-fg hover:underline font-normal normal-case">none</button>
                          </span>
                        ) : 'Update design?'}
                      </th>
                      <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Status</th>
                      <th className="text-left font-medium px-3 py-2 whitespace-nowrap">Date added</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const matchedLot = lots.find((l) => l.id === row.matchedLotId)
                      return (
                        <tr key={rowKey(row, i)} className="border-b border-border-subtle last:border-0">
                          <td className="px-3 py-2 max-w-[220px] truncate text-fg-secondary" title={row.filename}>{row.filename}</td>
                          <td className="px-3 py-2 text-fg-secondary whitespace-nowrap">{row.parsedLotNumber ?? '—'}</td>
                          <td className="px-3 py-2 text-fg-secondary whitespace-nowrap">{row.parsedHomeDesign ?? '—'}</td>
                          <td className="px-3 py-2">
                            <select
                              value={row.matchedLotId ?? ''}
                              onChange={(e) => setRowMatchedLot(i, e.target.value || null)}
                              disabled={!!row.importedAt}
                              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 max-w-[220px] disabled:opacity-50"
                            >
                              <option value="">— No match —</option>
                              {lotsBySite.map(([siteName, siteLots]) => (
                                <optgroup key={siteName} label={siteName}>
                                  {siteLots.map((lot) => (
                                    <option key={lot.id} value={lot.id}>
                                      Lot {lot.lotNumber} · {lot.stageName}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.updateHomeDesign}
                              disabled={!row.parsedHomeDesign || !row.matchedLotId || !!row.importedAt}
                              onChange={(e) => setRowUpdateHomeDesign(i, e.target.checked)}
                              className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600 disabled:opacity-30"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.importedAt ? (
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">✓ Imported</span>
                            ) : row.error ? (
                              <span className="text-xs font-medium text-red-600" title={row.error}>✗ Failed</span>
                            ) : matchedLot ? (
                              <span className="text-xs font-medium text-green-700 dark:text-green-400">✓ Ready</span>
                            ) : (
                              <span className="text-xs font-medium text-fg-muted">✗ No match — skipped</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-fg-muted">
                            {row.importedAt ? formatAddedDate(row.importedAt) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              title="Remove"
                              className="text-fg-muted hover:text-red-600"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={readyCount === 0 || importing}
                onClick={handleImport}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? 'Importing…' : `Import ${readyCount} file${readyCount !== 1 ? 's' : ''}`}
              </button>
              {(() => {
                const unmatchedCount = rows.filter((r) => !r.matchedLotId && !r.importedAt).length
                return unmatchedCount > 0 ? (
                  <span className="text-xs text-fg-muted">{unmatchedCount} unmatched file{unmatchedCount !== 1 ? 's' : ''} will be skipped</span>
                ) : null
              })()}
            </div>
          )}

          {result && (
            <p className={`rounded-lg px-3 py-2 text-sm ${result.errors.length > 0 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
              Imported {result.imported} file{result.imported !== 1 ? 's' : ''}.
              {result.errors.length > 0 && ` ${result.errors.length} failed — see rows above.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
