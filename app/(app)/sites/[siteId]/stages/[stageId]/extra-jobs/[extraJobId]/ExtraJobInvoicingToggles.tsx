'use client'

import { useState, useTransition } from 'react'
import { toggleExtraJobPendingReview, toggleExtraJobApprovedForInvoicing } from '@/app/(app)/invoices/actions'
import { useSyncedState } from '@/lib/useSyncedState'
import { UNAPPROVE_FIRST_EXTRA_JOB } from '@/lib/lotReview'

// Admin-only Pending Review / Approved for Invoicing pills — the same actions
// and rules as the extra job row on the Invoices page.

type Flag = 'pending_review' | 'approved_for_invoicing'

interface Props {
  extraJobId: string
  siteId: string
  stageId: string
  pendingReview: boolean
  approvedForInvoicing: boolean
}

export default function ExtraJobInvoicingToggles({
  extraJobId, siteId, stageId,
  pendingReview: initPendingReview,
  approvedForInvoicing: initApprovedForInvoicing,
}: Props) {
  const [pendingReview,        setPendingReview]        = useSyncedState(initPendingReview)
  const [approvedForInvoicing, setApprovedForInvoicing] = useSyncedState(initApprovedForInvoicing)
  const [error, setError]            = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(flag: Flag, current: boolean, set: (v: boolean) => void) {
    const next = !current
    if (flag === 'pending_review' && next && approvedForInvoicing) {
      setError(UNAPPROVE_FIRST_EXTRA_JOB)
      return
    }
    const prevPendingReview = pendingReview
    set(next)
    setError(null)
    if (flag === 'approved_for_invoicing' && next) setPendingReview(false)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('extra_job_id', extraJobId)
      fd.set('site_id',      siteId)
      fd.set('stage_id',     stageId)
      fd.set('value',        String(next))
      const result = flag === 'pending_review'
        ? await toggleExtraJobPendingReview(null, fd)
        : await toggleExtraJobApprovedForInvoicing(null, fd)
      if (result?.error) {
        set(current)
        // A failed approval didn't clear Pending review — show it again
        if (flag === 'approved_for_invoicing' && next) setPendingReview(prevPendingReview)
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => toggle('pending_review', pendingReview, setPendingReview)}
          title={approvedForInvoicing && !pendingReview ? 'Un-approve first' : undefined}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
            approvedForInvoicing && !pendingReview ? 'opacity-50 ' : ''
          }${
            pendingReview ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-surface-raised text-fg-muted hover:bg-surface-raised'
          }`}
        >
          Pending Review
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => toggle('approved_for_invoicing', approvedForInvoicing, setApprovedForInvoicing)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
            approvedForInvoicing ? 'bg-accent-dim text-accent-fg' : 'bg-surface-raised text-fg-muted hover:bg-surface-raised'
          }`}
        >
          Approved for Invoicing
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
