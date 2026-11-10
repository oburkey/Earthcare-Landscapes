'use client'

import { useState } from 'react'
import { getReferenceDocUrl } from '@/app/(app)/safety/forms-actions'
import { startDownload } from '@/app/(app)/safety/signedPdf'
import Modal from '@/app/_components/Modal'

// Read-only list of this site's WHS reference documents for the crew.
// They're uploaded and managed in Safety → Safety Admin → Reference documents.

export type ReferenceDocRow = {
  id: string
  title: string
  hasFile: boolean
  contentHtml: string | null
  createdAt: string
  updatedAt: string
}

interface Props {
  docs: ReferenceDocRow[]
}

export default function SiteReferenceDocs({ docs }: Props) {
  const [viewing, setViewing] = useState<ReferenceDocRow | null>(null)
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function handleDownload(doc: ReferenceDocRow) {
    setBusyId(doc.id); setError(null)
    const result = await getReferenceDocUrl(doc.id)
    setBusyId(null)
    if (!result.url) { setError(result.error ?? 'Could not download.'); return }
    startDownload(result.url)
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-fg-secondary">WHS Reference Documents</h2>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-sm text-fg-muted">No WHS reference documents for this site.</p>
      ) : (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border-subtle overflow-hidden">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{doc.title}</p>
                <p className="text-xs text-fg-muted">
                  Updated {new Date(doc.updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Perth' })}
                </p>
              </div>
              {doc.hasFile ? (
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  disabled={busyId === doc.id}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-50 transition-colors"
                >
                  {busyId === doc.id ? '…' : 'Download'}
                </button>
              ) : doc.contentHtml ? (
                <button
                  type="button"
                  onClick={() => setViewing(doc)}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
                >
                  View
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <Modal
          title={viewing.title}
          width="3xl"
          onClose={() => setViewing(null)}
          headerAction={
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
            >
              Close
            </button>
          }
        >
          <div
            className="prose prose-sm max-w-none text-fg"
            dangerouslySetInnerHTML={{ __html: viewing.contentHtml ?? '' }}
          />
        </Modal>
      )}
    </div>
  )
}
