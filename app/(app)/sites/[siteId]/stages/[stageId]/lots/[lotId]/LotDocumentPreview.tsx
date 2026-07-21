'use client'

import { useState } from 'react'

interface DocPreview {
  id: string
  document_name: string
  url: string
  storage_path: string
}

function isImagePath(path: string): boolean {
  const lower = path.toLowerCase()
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  )
}

function PreviewCard({ doc }: { doc: DocPreview }) {
  const [imgFailed, setImgFailed] = useState(false)
  const isImage = isImagePath(doc.storage_path)

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Preview area */}
      <div className="relative overflow-hidden bg-surface-raised" style={{ height: '260px' }}>
        {isImage && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.url}
            alt={doc.document_name}
            loading="lazy"
            className="w-full h-full object-contain"
            onError={() => setImgFailed(true)}
          />
        ) : isImage && imgFailed ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-fg-muted">Preview unavailable</p>
          </div>
        ) : (
          /* PDF — browser built-in renderer via iframe. pointer-events:none prevents
             interacting with PDF controls; the overlay link handles click-to-open. */
          <iframe
            src={doc.url}
            loading="lazy"
            className="w-full h-full border-0"
            title={doc.document_name}
            style={{ pointerEvents: 'none' }}
            scrolling="no"
          />
        )}
        {/* Absolute overlay link so clicking the preview opens the document */}
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-10"
          aria-label={`Open ${doc.document_name}`}
        />
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-border-subtle flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg-secondary truncate">{doc.document_name}</p>
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-accent-fg hover:underline whitespace-nowrap"
        >
          Open ↗
        </a>
      </div>
    </div>
  )
}

export default function LotDocumentPreview({ documents }: { documents: DocPreview[] }) {
  if (documents.length === 0) return null

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {documents.map((doc) => (
        <PreviewCard key={doc.id} doc={doc} />
      ))}
    </div>
  )
}
