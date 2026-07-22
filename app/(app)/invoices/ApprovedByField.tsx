'use client'

import { useState, useTransition } from 'react'
import { updateExtraJobApprovedBy } from './actions'

interface Props {
  extraJobId: string
  approvedByName: string | null
}

// Inline free-text field, saved on blur — not a profiles lookup, since
// approval sometimes comes from an external developer's contact rather than
// a user in the system.
export default function ApprovedByField({ extraJobId, approvedByName }: Props) {
  const [value, setValue] = useState(approvedByName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleBlur() {
    const trimmed = value.trim()
    if (trimmed === (approvedByName ?? '')) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('extra_job_id', extraJobId)
      fd.set('approved_by_name', trimmed)
      const result = await updateExtraJobApprovedBy(null, fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onClick={(e) => e.stopPropagation()}
      disabled={isPending}
      placeholder="Approved by"
      title={error ?? undefined}
      className={`w-32 shrink-0 rounded-lg border px-2 py-1 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50 ${
        error ? 'border-red-400' : 'border-border focus:border-green-600'
      }`}
    />
  )
}
