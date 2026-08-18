'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { previewBulkUpdateLots, bulkUpdateLots } from './actions'
import type { BulkUpdateResult, BulkDateMode, BulkPreviewRow } from './actions'

interface Props {
  stageId: string
  siteId:  string
}

const PLACEHOLDER: Record<BulkDateMode, string> = {
  due_only:         '059\t03/04/2026\tBillie Jean\n076\t03/04/2026\n077\t25/03/2026\tCecilia',
  start_and_due:    '059\t20/03/2026\t03/04/2026\tBillie Jean\n076\t\t03/04/2026\n077\t18/03/2026\t\tCecilia',
  start_only:       '059\t20/03/2026\tBillie Jean\n076\t18/03/2026\n077\t25/03/2026\tCecilia',
  home_design_only: '088\tSunshine\n089\tBrightside\n090\tDream Catcher',
}

const HELP_TEXT: Record<BulkDateMode, string> = {
  due_only:         'One lot per line — lot number, then tab or comma, then due date in DD/MM/YYYY format, then optionally tab/comma and a Home Design name.',
  start_and_due:    'One lot per line — lot number, then tab or comma, then start date, then due date (both DD/MM/YYYY, either can be left blank), then optionally a Home Design name.',
  start_only:       'One lot per line — lot number, then tab or comma, then start date in DD/MM/YYYY format, then optionally tab/comma and a Home Design name. Due dates are left untouched.',
  home_design_only: 'One lot per line — lot number, then tab or comma, then Home Design name. No dates are touched.',
}

function formatDateDisplay(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function BulkUpdateLotsButton({ stageId, siteId }: Props) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [text, setText]     = useState('')
  const [mode, setMode]     = useState<BulkDateMode>('due_only')
  const [preview, setPreview] = useState<BulkPreviewRow[] | null>(null)
  const [result, setResult]   = useState<BulkUpdateResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setText('')
    setMode('due_only')
    setPreview(null)
    setResult(null)
  }

  function handleOpen() {
    reset()
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    reset()
  }

  function handleTextChange(value: string) {
    setText(value)
    setPreview(null)
    setResult(null)
  }

  function handleModeChange(value: BulkDateMode) {
    setMode(value)
    setPreview(null)
    setResult(null)
  }

  function handlePreview() {
    startTransition(async () => {
      const rows = await previewBulkUpdateLots(stageId, text, mode)
      setPreview(rows)
      setResult(null)
    })
  }

  function handleConfirm() {
    startTransition(async () => {
      const r = await bulkUpdateLots(stageId, siteId, text, mode)
      setResult(r)
      setPreview(null)
      if (r.updated > 0 || r.created > 0) {
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleOpen}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised transition-colors"
        >
          Bulk update lots
        </button>
      </div>
    )
  }

  const validRowCount = preview?.filter((r) => !r.error).length ?? 0

  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-fg-secondary">Bulk update lots</p>
        <button
          type="button"
          onClick={handleClose}
          className="text-xs text-fg-muted hover:text-fg-secondary transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Format toggle */}
      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        {(['due_only', 'start_and_due', 'start_only', 'home_design_only'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              mode === m ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900' : 'text-fg-muted hover:bg-surface-raised'
            }`}
          >
            {m === 'due_only' ? 'Due date only'
              : m === 'start_and_due' ? 'Start + Due date'
              : m === 'start_only' ? 'Start date only'
              : 'Home Design only'}
          </button>
        ))}
      </div>

      <p className="text-xs text-fg-muted">
        {HELP_TEXT[mode]} Lots that exist will be updated; lots that don&apos;t exist will be created.
      </p>

      <textarea
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        placeholder={PLACEHOLDER[mode]}
        rows={6}
        disabled={isPending}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono text-fg placeholder:text-fg-muted focus:border-border focus:outline-none resize-y disabled:opacity-60 bg-surface"
      />

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-raised text-fg-muted sticky top-0">
                  <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">Lot</th>
                  {(mode === 'start_and_due' || mode === 'start_only') && (
                    <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">Start Date</th>
                  )}
                  {mode !== 'start_only' && mode !== 'home_design_only' && (
                    <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">Due Date</th>
                  )}
                  <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">Home Design</th>
                  <th className="text-left font-medium px-2.5 py-1.5 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-border-subtle last:border-0">
                    <td className="px-2.5 py-1.5 text-fg-secondary whitespace-nowrap">{row.lotNumber ?? '—'}</td>
                    {(mode === 'start_and_due' || mode === 'start_only') && (
                      <td className="px-2.5 py-1.5 text-fg-secondary whitespace-nowrap">{formatDateDisplay(row.startDate)}</td>
                    )}
                    {mode !== 'start_only' && mode !== 'home_design_only' && (
                      <td className="px-2.5 py-1.5 text-fg-secondary whitespace-nowrap">{formatDateDisplay(row.dueDate)}</td>
                    )}
                    <td className="px-2.5 py-1.5 text-fg-secondary whitespace-nowrap">{row.homeDesign ?? '—'}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">
                      {row.error ? (
                        <span className="font-medium text-red-600" title={row.error}>✗ {row.error}</span>
                      ) : row.action === 'create' ? (
                        <span className="font-medium text-accent-fg">+ Create</span>
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
            {', '}
            <span className="font-semibold text-accent-fg">{result.created} created</span>
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
              {isPending ? 'Importing…' : `Confirm import (${validRowCount})`}
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
        {result && (result.updated > 0 || result.created > 0) && (
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-fg-muted hover:text-fg-secondary transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  )
}
