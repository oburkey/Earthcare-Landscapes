'use client'

import { useState, useTransition } from 'react'
import { getStageEstimatesExport } from './export-estimates-actions'
import { downloadStageEstimatesXlsx } from './xlsxExport'

interface Props {
  stageId: string
}

export default function ExportEstimatesButton({ stageId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleExport() {
    setError(null)
    startTransition(async () => {
      const result = await getStageEstimatesExport(stageId)
      if (result.error || !result.data) {
        setError(result.error ?? 'Failed to export estimates.')
        return
      }
      try {
        await downloadStageEstimatesXlsx(result.data)
      } catch {
        setError('Failed to generate the Excel file.')
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-fg-secondary hover:bg-surface-raised disabled:opacity-60 transition-colors"
      >
        {isPending ? 'Exporting…' : 'Export estimates'}
      </button>
      {error && <p className="text-xs text-red-600 max-w-[200px] text-right">{error}</p>}
    </div>
  )
}
