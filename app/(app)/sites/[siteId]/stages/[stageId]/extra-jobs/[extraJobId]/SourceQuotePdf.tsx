'use client'

import { useState } from 'react'
import { buildQuoteHtml, downloadPDF, type LineItem } from '@/app/(app)/quotes/QuotesView'
import { LOGO_DATA_URL } from '@/lib/pdfAssets'

export default function SourceQuotePdf({
  siteName,
  reference,
  description,
  lineItems,
  notes,
}: {
  siteName: string | null
  reference: string
  description: string
  lineItems: LineItem[]
  notes: string
}) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleDownload() {
    const filename = `Quote-${reference || 'source'}.pdf`
    const html = buildQuoteHtml(siteName, reference, description, lineItems, notes, LOGO_DATA_URL)
    setGenerating(true)
    setError(null)
    downloadPDF(html, filename, (msg) => setError(msg), () => setGenerating(false))
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-blue-600">Source quote</p>
          <p className="text-sm text-blue-800 truncate">{reference || description || 'Converted from quote'}</p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={generating}
          className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60 transition-colors shrink-0"
        >
          {generating ? (
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          )}
          {generating ? 'Generating...' : 'View quote PDF'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
