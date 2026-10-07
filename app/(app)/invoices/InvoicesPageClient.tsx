'use client'

import { useState } from 'react'
import InvoicesView, { type SiteData } from './InvoicesView'
import ApprovedPanel, { type ApprovedLot, type ApprovedExtraJob, type ApprovedProgressClaim } from './ApprovedPanel'

// Holds the single "Hide pricing" toggle shared by every lot quant sheet PDF
// download on this page (ApprovedPanel's ZIP + InvoicesView's claim sheets).
// It lives here, in a client component, because ApprovedPanel and
// InvoicesView are rendered as siblings from the server page — this is the
// smallest shared client boundary that can hold that state.
export default function InvoicesPageClient({
  sites,
  approvedLots,
  approvedExtraJobs,
  approvedProgressClaims,
  lotIssuesById,
  extraJobIssuesById,
}: {
  sites: SiteData[]
  approvedLots: ApprovedLot[]
  approvedExtraJobs: ApprovedExtraJob[]
  approvedProgressClaims: ApprovedProgressClaim[]
  lotIssuesById: Record<string, string[]>
  extraJobIssuesById: Record<string, string[]>
}) {
  const [hidePricing, setHidePricing] = useState(false)

  return (
    <>
      <div className="flex justify-end">
        <label className="flex items-center gap-2 text-sm text-fg-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hidePricing}
            onChange={(e) => setHidePricing(e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent-fg focus:ring-green-600 cursor-pointer"
          />
          Hide pricing on lot PDFs
        </label>
      </div>
      <ApprovedPanel
        lots={approvedLots}
        extraJobs={approvedExtraJobs}
        progressClaims={approvedProgressClaims}
        hidePricing={hidePricing}
      />
      <InvoicesView
        sites={sites}
        isAdmin={true}
        hidePricing={hidePricing}
        lotIssuesById={lotIssuesById}
        extraJobIssuesById={extraJobIssuesById}
      />
    </>
  )
}
