'use client'

import { useState, useTransition } from 'react'
import { updateLotHomeDesign } from './actions'

interface Props {
  lotId: string
  siteId: string
  stageId: string
  homeDesign: string | null
  canEdit: boolean
}

// Inline free-text field, saved on blur — free text for now, will be
// standardised against the House Types catalogue later.
export default function HomeDesignField({ lotId, siteId, stageId, homeDesign, canEdit }: Props) {
  const [value, setValue] = useState(homeDesign ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleBlur() {
    const trimmed = value.trim()
    if (trimmed === (homeDesign ?? '')) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('lot_id', lotId)
      fd.set('site_id', siteId)
      fd.set('stage_id', stageId)
      fd.set('home_design', trimmed)
      const result = await updateLotHomeDesign(null, fd)
      if (result?.error) setError(result.error)
    })
  }

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-fg-muted">Home Design</span>
        <span className="text-fg-secondary">{homeDesign || '—'}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="home_design" className="text-sm text-fg-muted shrink-0">Home Design</label>
      <input
        id="home_design"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        disabled={isPending}
        placeholder="e.g. Billie Jean"
        title={error ?? undefined}
        className={`w-40 rounded-lg border px-2 py-1 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-green-600 disabled:opacity-50 ${
          error ? 'border-red-400' : 'border-border focus:border-green-600'
        }`}
      />
    </div>
  )
}
