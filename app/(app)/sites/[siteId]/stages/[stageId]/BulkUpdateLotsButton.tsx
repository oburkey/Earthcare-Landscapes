'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkUpdateLots } from './actions'
import type { BulkUpdateResult } from './actions'

interface Props {
  stageId: string
  siteId:  string
}

export default function BulkUpdateLotsButton({ stageId, siteId }: Props) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [text, setText]         = useState('')
  const [result, setResult]     = useState<BulkUpdateResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setText('')
    setResult(null)
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    setText('')
    setResult(null)
  }

  function handleProcess() {
    startTransition(async () => {
      const r = await bulkUpdateLots(stageId, siteId, text)
      setResult(r)
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
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          Bulk update lots
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">Bulk update lots</p>
        <button
          type="button"
          onClick={handleClose}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-stone-500">
        One lot per line — lot number, then tab or comma, then date in{' '}
        <span className="font-mono">DD/MM/YYYY</span> format. Lots that exist will be
        updated; lots that don&apos;t exist will be created.
      </p>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'059\t03/04/2026\n076\t03/04/2026\n077\t25/03/2026'}
        rows={6}
        disabled={isPending}
        className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono text-stone-900 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none resize-y disabled:opacity-60"
      />

      {result && (
        <div className="space-y-2">
          <p className="text-sm text-stone-700">
            <span className="font-semibold text-green-700">{result.updated} updated</span>
            {', '}
            <span className="font-semibold text-green-700">{result.created} created</span>
            {result.errors.length > 0 && (
              <span className="text-stone-400">{', '}{result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</span>
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
        <button
          type="button"
          onClick={handleProcess}
          disabled={isPending || !text.trim()}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Processing…' : 'Process'}
        </button>
        {result && (result.updated > 0 || result.created > 0) && (
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  )
}
