'use client'

import { useRef, useState } from 'react'
import { uploadSafetyDocument, deleteSafetyDocument, signOffDocument, getSafetyDocUrl } from './actions'
import type { Role } from '@/types/database'
import type { SafetyDocRow, SignoffRow } from './SafetyView'

interface Props {
  docs:           SafetyDocRow[]
  mySignoffIds:   string[]
  signoffs:       SignoffRow[]
  role:           Role
  userId:         string
  userName:       string
  isSupervisorPlus: boolean
  tableExists:    boolean
}

export default function DocumentsTab({
  docs: initialDocs,
  mySignoffIds: initialMySignoffIds,
  signoffs,
  isSupervisorPlus,
  tableExists,
}: Props) {
  const [docs, setDocs]                       = useState<SafetyDocRow[]>(initialDocs)
  const [mySignoffIds, setMySignoffIds]        = useState<string[]>(initialMySignoffIds)

  // Upload form
  const [showUpload, setShowUpload]           = useState(false)
  const [uploadTitle, setUploadTitle]         = useState('')
  const [uploadDesc, setUploadDesc]           = useState('')
  const [uploadFile, setUploadFile]           = useState<File | null>(null)
  const [uploading, setUploading]             = useState(false)
  const [uploadError, setUploadError]         = useState<string | null>(null)
  const fileInputRef                          = useRef<HTMLInputElement>(null)

  // Signoff state — tracks which doc is in the sign-off flow
  const [signingDocId, setSigningDocId]       = useState<string | null>(null)
  const [signNotes, setSignNotes]             = useState('')
  const [signing, setSigning]                 = useState(false)
  const [signError, setSignError]             = useState<string | null>(null)

  // Download state
  const [downloadingId, setDownloadingId]     = useState<string | null>(null)

  // Delete state
  const [deletingId, setDeletingId]           = useState<string | null>(null)
  const [actionError, setActionError]         = useState<string | null>(null)

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!uploadFile) { setUploadError('Please choose a file'); return }
    if (!uploadTitle.trim()) { setUploadError('Title is required'); return }

    setUploading(true)
    setUploadError(null)

    const fd = new FormData()
    fd.set('title', uploadTitle.trim())
    fd.set('description', uploadDesc)
    fd.set('file', uploadFile)

    const result = await uploadSafetyDocument(fd)
    setUploading(false)

    if (result?.error) { setUploadError(result.error); return }

    if ('doc' in result && result.doc) {
      setDocs(prev => [result.doc as SafetyDocRow, ...prev])
    }
    setShowUpload(false)
    setUploadTitle(''); setUploadDesc(''); setUploadFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Download ───────────────────────────────────────────────────────────────

  async function handleDownload(doc: SafetyDocRow) {
    setDownloadingId(doc.id)
    setActionError(null)
    const url = await getSafetyDocUrl(doc.filePath)
    setDownloadingId(null)
    if (url) {
      window.open(url, '_blank')
    } else {
      setActionError('Could not generate download link. Check R2 configuration.')
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(doc: SafetyDocRow) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    setDeletingId(doc.id)
    setActionError(null)
    const result = await deleteSafetyDocument(doc.id, doc.filePath)
    setDeletingId(null)
    if (result?.error) { setActionError(result.error); return }
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  // ── Sign off ───────────────────────────────────────────────────────────────

  function openSignoff(docId: string) {
    setSigningDocId(docId)
    setSignNotes('')
    setSignError(null)
  }

  async function handleSignoff() {
    if (!signingDocId) return
    setSigning(true)
    setSignError(null)
    const result = await signOffDocument(signingDocId, signNotes)
    setSigning(false)

    if (result?.error) { setSignError(result.error); return }

    setMySignoffIds(prev => [...prev, signingDocId])
    setDocs(prev => prev.map(d =>
      d.id === signingDocId ? { ...d, signoffCount: d.signoffCount + 1 } : d
    ))
    setSigningDocId(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Table not found */}
      {!tableExists && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The <code className="font-mono">safety_documents</code> table hasn&apos;t been created yet. Run the SQL migration to enable this feature.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </p>
        {isSupervisorPlus && !showUpload && (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
          >
            Upload document
          </button>
        )}
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold text-fg">Upload safety document</h3>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Title *</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              placeholder="e.g. Safe Work Method Statement — Earthworks"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-fg bg-surface placeholder:text-fg-muted focus:border-border focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Description</label>
            <textarea
              value={uploadDesc}
              onChange={e => setUploadDesc(e.target.value)}
              placeholder="Brief description of this document…"
              rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-fg bg-surface placeholder:text-fg-muted focus:border-border focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">File *</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              className="w-full text-sm text-fg-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:text-xs file:font-medium file:bg-surface-raised file:text-fg-secondary hover:file:bg-surface-raised"
            />
          </div>

          {uploadError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60 transition-colors"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => { setShowUpload(false); setUploadError(null) }}
              className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sign-off modal (inline) */}
      {signingDocId && (
        <div className="rounded-xl border border-green-200 bg-accent-dim p-4 space-y-3">
          <p className="text-sm font-semibold text-green-900">
            Sign off on: <span className="font-bold">{docs.find(d => d.id === signingDocId)?.title}</span>
          </p>
          <p className="text-xs text-accent-fg">
            By signing off, you confirm you have read and understood this document.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-accent-fg uppercase tracking-wide">Notes (optional)</label>
            <textarea
              value={signNotes}
              onChange={e => setSignNotes(e.target.value)}
              placeholder="Any notes or comments…"
              rows={2}
              className="w-full rounded-lg border border-green-200 bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-400 focus:outline-none resize-none"
            />
          </div>
          {signError && <p className="text-sm text-red-700">{signError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSignoff}
              disabled={signing}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60 transition-colors"
            >
              {signing ? 'Signing…' : 'Confirm sign-off'}
            </button>
            <button
              type="button"
              onClick={() => setSigningDocId(null)}
              className="text-sm text-accent-fg hover:text-green-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Documents list */}
      {actionError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
      )}

      {docs.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-14 text-center">
          <p className="text-sm font-medium text-fg-muted">No safety documents uploaded yet</p>
          {isSupervisorPlus && (
            <p className="mt-1 text-sm text-fg-muted">
              Click <span className="font-medium">Upload document</span> to add your first document.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {docs.map(doc => {
            const signed    = mySignoffIds.includes(doc.id)
            const isDeleting = deletingId === doc.id
            const isDownloading = downloadingId === doc.id

            // How many signoffs visible to current user for this doc
            const docSignoffs = signoffs.filter(s => s.documentId === doc.id)

            return (
              <div key={doc.id} className="px-5 py-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-fg text-sm">{doc.title}</span>
                      {signed && (
                        <span className="rounded-full bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent-fg">
                          Signed ✓
                        </span>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-sm text-fg-muted">{doc.description}</p>
                    )}
                    <p className="text-xs text-fg-muted">
                      Uploaded by {doc.uploaderName} · {new Date(doc.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isSupervisorPlus && ` · ${doc.signoffCount} sign-off${doc.signoffCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Download */}
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      disabled={isDownloading}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-60 transition-colors"
                    >
                      {isDownloading ? (
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      )}
                      {isDownloading ? 'Loading…' : 'Download'}
                    </button>

                    {/* Sign off */}
                    {!signed && !signingDocId && (
                      <button
                        type="button"
                        onClick={() => openSignoff(doc.id)}
                        className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 transition-colors"
                      >
                        Sign off
                      </button>
                    )}

                    {/* Delete (supervisor+) */}
                    {isSupervisorPlus && (
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        disabled={isDeleting}
                        className="text-fg-muted hover:text-red-500 disabled:opacity-40 transition-colors"
                        title="Delete document"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Signoff list (supervisor sees all for this doc) */}
                {isSupervisorPlus && docSignoffs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {docSignoffs.map(s => (
                      <span key={s.id} className="rounded-full bg-accent-dim border border-green-100 px-2 py-0.5 text-xs text-accent-fg">
                        {s.signerName} · {new Date(s.signedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
