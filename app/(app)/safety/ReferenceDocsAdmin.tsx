'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadReferenceDoc, deleteReferenceDoc, getReferenceDocUrl } from './forms-actions'
import { startDownload } from './signedPdf'
import type { SiteOption } from './AssignFormsTab'

// Safety Admin → Reference documents: uploaded PDFs with no signatures, per
// site. Admins upload and delete; everyone else can download. The same
// documents show read-only on each site page for the crew.

export type ReferenceDocAdminRow = {
  id: string
  title: string
  siteId: string
  siteName: string
  fileName: string | null
  hasFile: boolean
  createdAt: string
}

interface Props {
  docs: ReferenceDocAdminRow[]
  sites: SiteOption[]
  isAdmin: boolean
}

export default function ReferenceDocsAdmin({ docs, sites, isAdmin }: Props) {
  const router = useRouter()
  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle]           = useState('')
  const [siteId, setSiteId]         = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [saving, setSaving]         = useState(false)
  const [busyId, setBusyId]         = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  async function handleUpload() {
    setError(null)
    if (!title.trim()) { setError('Title is required.'); return }
    if (!siteId) { setError('Select a site.'); return }
    if (!file) { setError('Choose a PDF to upload.'); return }
    setSaving(true)
    const fd = new FormData()
    fd.set('title', title.trim())
    fd.set('site_id', siteId)
    fd.set('file', file)
    const result = await uploadReferenceDoc(fd)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setTitle(''); setSiteId(''); setFile(null); setShowUpload(false)
    router.refresh()
  }

  async function handleDownload(doc: ReferenceDocAdminRow) {
    setBusyId(doc.id); setError(null)
    const result = await getReferenceDocUrl(doc.id)
    setBusyId(null)
    if (!result.url) { setError(result.error ?? 'Could not download.'); return }
    startDownload(result.url)
  }

  async function handleDelete(doc: ReferenceDocAdminRow) {
    if (!window.confirm(`Delete "${doc.title}" from ${doc.siteName}? The file is removed too.`)) return
    setBusyId(doc.id); setError(null)
    const result = await deleteReferenceDoc(doc.id, doc.siteId)
    setBusyId(null)
    if (result?.error) { setError(result.error); return }
    router.refresh()
  }

  const sorted = [...docs].sort((a, b) => a.siteName.localeCompare(b.siteName) || a.title.localeCompare(b.title))

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowUpload(v => !v)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
          >
            {showUpload ? 'Cancel' : '+ Upload PDF'}
          </button>
        </div>
      )}

      {isAdmin && showUpload && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. WHS Management Plan"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg mb-1">Site *</label>
              <select
                value={siteId}
                onChange={e => setSiteId(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-green-600"
              >
                <option value="">— Select site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-1">PDF *</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-fg-secondary"
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={saving}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-sm text-fg-muted">No reference documents yet.</p>
      ) : (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
          {sorted.map(doc => (
            <div key={doc.id} className="flex flex-wrap items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{doc.title}</p>
                <p className="text-xs text-fg-muted">
                  {doc.siteName}
                  {doc.fileName && ` · ${doc.fileName}`}
                  {' · Added '}
                  {new Date(doc.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Perth' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.hasFile ? (
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    disabled={busyId === doc.id}
                    className="text-xs font-medium text-fg-muted hover:text-green-700 disabled:opacity-50 transition-colors"
                  >
                    {busyId === doc.id ? '…' : 'Download'}
                  </button>
                ) : (
                  <span className="text-xs text-fg-muted">Typed document (no file)</span>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={busyId === doc.id}
                    className="text-xs text-fg-muted hover:text-red-600 disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
