'use client'

import { useState, useTransition } from 'react'
import { updateExtraJobFinanceNotes } from './actions'

interface Props {
  extraJobId: string
  financeNotes: string | null
}

// Inline free-text field, saved on blur — same pattern as ApprovedByField.
// Admin-only note finance can use for anything relevant to invoicing this
// job (e.g. "Invoice to XYZ Pty Ltd"). Shown on the extra job's claim PDF.
export default function FinanceNotesField({ extraJobId, financeNotes }: Props) {
  const [value, setValue] = useState(financeNotes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleBlur() {
    const trimmed = value.trim()
    if (trimmed === (financeNotes ?? '')) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('extra_job_id', extraJobId)
      fd.set('finance_notes', trimmed)
      const result = await updateExtraJobFinanceNotes(null, fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      disabled={isPending}
      rows={1}
      placeholder="Finance notes"
      title={error ?? undefined}
      className={`w-40 shrink-0 resize-y rounded-lg border px-2 py-1 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50 ${
        error ? 'border-red-400' : 'border-border focus:border-green-600'
      }`}
    />
  )
}
