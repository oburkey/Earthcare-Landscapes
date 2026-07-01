'use client'

import { useState } from 'react'
import { createReferenceDoc, updateReferenceDoc, deleteReferenceDoc } from '@/app/(app)/safety/forms-actions'

export type ReferenceDocRow = {
  id: string
  title: string
  contentHtml: string
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

interface Props {
  siteId: string
  docs: ReferenceDocRow[]
  isAdmin: boolean
}

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; doc: ReferenceDocRow }
  | { mode: 'view'; doc: ReferenceDocRow }
  | null

export default function SiteReferenceDocs({ siteId, docs: initial, isAdmin }: Props) {
  const [docs, setDocs]         = useState<ReferenceDocRow[]>(initial)
  const [modal, setModal]       = useState<ModalState>(null)
  const [title, setTitle]       = useState('')
  const [content, setContent]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  function openCreate() {
    setTitle(''); setContent(''); setError(null); setModal({ mode: 'create' })
  }

  function openEdit(doc: ReferenceDocRow) {
    setTitle(doc.title); setContent(doc.contentHtml); setError(null); setModal({ mode: 'edit', doc })
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true); setError(null)
    try {
      if (modal?.mode === 'create') {
        const result = await createReferenceDoc({ title: title.trim(), site_id: siteId, template_id: null, content_html: content })
        if (result?.error) { setError(result.error); return }
        if (result.doc) {
          const d = result.doc
          setDocs(prev => [{
            id: d.id, title: d.title, contentHtml: d.content_html,
            uploadedBy: d.uploaded_by, createdAt: d.created_at, updatedAt: d.updated_at,
          }, ...prev])
        }
      } else if (modal?.mode === 'edit') {
        const result = await updateReferenceDoc(modal.doc.id, { title: title.trim(), content_html: content, site_id: siteId })
        if (result?.error) { setError(result.error); return }
        setDocs(prev => prev.map(d => d.id === (modal as { doc: ReferenceDocRow }).doc.id
          ? { ...d, title: title.trim(), contentHtml: content, updatedAt: new Date().toISOString() }
          : d
        ))
      }
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(doc: ReferenceDocRow) {
    if (!confirm(`Delete "${doc.title}"?`)) return
    setDeleting(doc.id)
    const result = await deleteReferenceDoc(doc.id, siteId)
    setDeleting(null)
    if (result?.error) { setError(result.error); return }
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-fg-secondary">WHS Reference Documents</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 active:bg-green-900 transition-colors"
          >
            + Add document
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-sm text-fg-muted">{isAdmin ? 'No documents yet.' : 'No WHS reference documents for this site.'}</p>
      ) : (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{doc.title}</p>
                <p className="text-xs text-fg-muted">
                  Updated {new Date(doc.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModal({ mode: 'view', doc })}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
                >
                  View
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(doc)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      disabled={deleting === doc.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {deleting === doc.id ? '…' : 'Delete'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View modal */}
      {modal?.mode === 'view' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="text-base font-semibold text-fg">{modal.doc.title}</h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
              >
                Close
              </button>
            </div>
            <div className="p-6">
              <div
                className="prose prose-sm max-w-none text-fg"
                dangerouslySetInnerHTML={{ __html: modal.doc.contentHtml }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {(modal?.mode === 'create' || modal?.mode === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-fg">
              {modal.mode === 'create' ? 'New WHS reference document' : 'Edit document'}
            </h3>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-fg mb-1">Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600"
                placeholder="e.g. WHS Management Plan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fg mb-1">Content (HTML)</label>
              <textarea
                rows={14}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Document content as HTML. Use &lt;p&gt;, &lt;ul&gt;, &lt;h3&gt; etc."
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg font-mono placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600 resize-y"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : modal.mode === 'create' ? 'Create' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
