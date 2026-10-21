'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { previewBulkContractPrices, bulkUpdateContractPrices } from './actions'
import type { BulkContractPriceRow, BulkUpdateResult } from './actions'

interface Props {
  stageId: string
  siteId:  string
  onDone:  () => void
}

const PLACEHOLDER = '088\t7880\n091\t$8,250\n094'

function fmtPrice(n: number): string {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Admin-only "Contract price" mode of the stage bulk lot update. Sets each
// lot's own contract_price (overriding the stage default); a blank price
// clears it so the lot falls back to the stage default. Update-only — lot
// numbers with no match in the stage are flagged, never created.
export default function BulkContractPriceImport({ stageId, siteId, onDone }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<BulkContractPriceRow[] | null>(null)
  const [stageDefault, setStageDefault] = useState<number | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkUpdateResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleTextChange(value: string) {
    setText(value)
    setPreview(null)
    setPreviewError(null)
    setResult(null)
  }

  function handlePreview() {
    startTransition(async () => {
      const r = await previewBulkContractPrices(stageId, text)
      setPreview(r.rows)
      setStageDefault(r.stageDefault)
      setPreviewError(r.error ?? null)
      setResult(null)
    })
  }

  function handleConfirm() {
    startTransition(async () => {
      const r = await bulkUpdateContractPrices(stageId, siteId, text)
      setResult(r)
      setPreview(null)
      if (r.updated > 0) router.refresh()
    })
  }

  // A lot with no price of its own uses the stage default — show which.
  function priceLabel(price: number | null): string {
    if (price != null) return fmtPrice(price)
    return stageDefault != null ? `Stage default (${fmtPrice(stageDefault)})` : 'None'
  }

  const validRowCount = preview?.filter((r) => !r.error).length ?? 0

  return (
    <>
      <p className="text-xs text-fg-muted">
        One lot per line — lot number, then tab or spaces, then the price ($ and commas are fine).
        Leave the price blank to clear the lot&apos;s own price so it uses the stage default.
        Only existing lots are updated; no lots are created.
      </p>

      <textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={6}
        disabled={isPending}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-y disabled:opacity-60 bg-surface"
      />

      {previewError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">{previewError}</p>
      )}

      {preview && preview.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-raised text-fg-muted sticky top-0">
                  <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">Lot</th>
                  <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">Current price</th>
                  <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">New price</th>
                  <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border-subtle last:border-0 ${row.error ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                  >
                    <td className="px-2.5 py-1.5 text-fg-secondary whitespace-nowrap">{row.lotNumber ?? '—'}</td>
                    <td className="px-2.5 py-1.5 text-fg-muted whitespace-nowrap">{row.error ? '—' : priceLabel(row.currentPrice)}</td>
                    <td className="px-2.5 py-1.5 text-fg-secondary whitespace-nowrap">
                      {row.error ? '—' : <>→ {priceLabel(row.newPrice)}</>}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {row.error ? (
                        <span className="font-medium text-red-600" title={row.error}>✗ {row.error}</span>
                      ) : row.newPrice === row.currentPrice ? (
                        <span className="font-medium text-fg-muted">No change</span>
                      ) : row.newPrice == null ? (
                        <span className="font-medium text-amber-600">Clear</span>
                      ) : (
                        <span className="font-medium text-green-700 dark:text-green-400">✓ Update</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-sm text-fg-secondary">
            <span className="font-semibold text-accent-fg">{result.updated} updated</span>
            {result.errors.length > 0 && (
              <span className="text-fg-muted">{', '}{result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</span>
            )}
          </p>
          {result.errors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 space-y-1">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        {!preview && !result && (
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPending || !text.trim()}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Parsing…' : 'Preview'}
          </button>
        )}
        {preview && (
          <>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending || validRowCount === 0}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Updating…' : `Confirm update (${validRowCount})`}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={isPending}
              className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
            >
              Back to edit
            </button>
          </>
        )}
        {result && result.updated > 0 && (
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </>
  )
}
