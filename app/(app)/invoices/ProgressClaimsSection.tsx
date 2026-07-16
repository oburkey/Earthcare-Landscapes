'use client'

import { useState, useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createProgressClaim,
  toggleProgressClaimPendingReview,
  toggleProgressClaimApprovedForInvoicing,
  toggleProgressClaimInvoiced,
  deleteProgressClaim,
} from './progress-claim-actions'
import type { ActionState } from '@/types/actions'

export type ProgressClaimRow = {
  id: string
  claimNumber: number
  percentage: number | null
  claimAmount: number
  notes: string | null
  pendingReview: boolean
  approvedForInvoicing: boolean
  invoiced: boolean
}

function fmt(n: number) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%'
}

// ── New claim form ────────────────────────────────────────────────────────────

function NewClaimForm({
  stageId,
  totalContractValue,
  onCancel,
}: {
  stageId: string
  totalContractValue: number
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createProgressClaim, null)
  const [pctInput, setPctInput]   = useState('')
  const [amtInput, setAmtInput]   = useState('')
  const [lastChanged, setLast]    = useState<'pct' | 'amt' | null>(null)

  function handlePctChange(v: string) {
    setPctInput(v)
    setLast('pct')
    const n = parseFloat(v)
    if (!isNaN(n) && totalContractValue > 0) {
      setAmtInput(((n / 100) * totalContractValue).toFixed(2))
    }
  }

  function handleAmtChange(v: string) {
    setAmtInput(v)
    setLast('amt')
    const n = parseFloat(v)
    if (!isNaN(n) && totalContractValue > 0) {
      setPctInput(((n / totalContractValue) * 100).toFixed(2))
    }
  }

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
      <input type="hidden" name="stage_id" value={stageId} />
      {/* Send whichever was last edited as the authoritative percentage */}
      <input type="hidden" name="percentage" value={lastChanged === 'pct' ? pctInput : (pctInput || '')} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Percentage of contract</label>
          <div className="relative">
            <input
              type="number"
              value={pctInput}
              onChange={(e) => handlePctChange(e.target.value)}
              min="0.01" max="100" step="0.01"
              placeholder="e.g. 25"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-7 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-fg-muted pointer-events-none">%</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Claim amount <span className="text-red-500">*</span></label>
          <input
            type="number"
            name="claim_amount"
            value={amtInput}
            onChange={(e) => handleAmtChange(e.target.value)}
            min="0.01" step="0.01"
            placeholder="0.00"
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Notes</label>
        <input
          type="text"
          name="notes"
          placeholder="Optional notes"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>

      {state?.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Creating…' : 'Create claim'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgressClaimsSection({
  stageId,
  initialClaims,
  totalContractValue,
  isAdmin,
}: {
  stageId: string
  initialClaims: ProgressClaimRow[]
  totalContractValue: number
  isAdmin: boolean
}) {
  const router = useRouter()
  const [claims, setClaims]       = useState(initialClaims)
  const [showForm, setShowForm]   = useState(false)
  const [actionError, setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Keep in sync when server refreshes page
  // (initialClaims prop changes on router.refresh())
  const [prevInitial, setPrevInitial] = useState(initialClaims)
  if (initialClaims !== prevInitial) {
    setPrevInitial(initialClaims)
    setClaims(initialClaims)
  }

  const claimedTotal  = claims.reduce((s, c) => s + c.claimAmount, 0)
  const invoicedTotal = claims.filter((c) => c.invoiced).reduce((s, c) => s + c.claimAmount, 0)
  const claimedPct    = totalContractValue > 0 ? (claimedTotal / totalContractValue) * 100 : 0
  const remaining     = totalContractValue - claimedTotal

  function optimisticToggle(
    id: string,
    field: 'pendingReview' | 'approvedForInvoicing' | 'invoiced',
    current: boolean,
    serverAction: (prev: ActionState, fd: FormData) => Promise<ActionState>,
    fdField: string,
  ) {
    const next = !current
    setClaims((prev) => prev.map((c) => {
      if (c.id !== id) return c
      const updated = { ...c, [field]: next }
      if (field === 'approvedForInvoicing' && next) updated.pendingReview = false
      return updated
    }))
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', id)
      fd.set(fdField, String(next))
      const result = await serverAction(null, fd)
      if (result?.error) {
        setClaims((prev) => prev.map((c) => c.id === id ? { ...c, [field]: current } : c))
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', id)
      const result = await deleteProgressClaim(null, fd)
      if (result?.error) {
        setError(result.error)
      } else {
        setClaims((prev) => prev.filter((c) => c.id !== id))
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">Progress Claims</p>

      {claims.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border-subtle">
          {claims.map((claim) => (
            <div key={claim.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
              <span className="text-sm font-medium text-fg shrink-0 w-16">
                Claim #{claim.claimNumber}
              </span>
              <span className="text-sm tabular-nums text-fg-secondary flex-1">
                {fmt(claim.claimAmount)}
                {claim.percentage != null && (
                  <span className="text-fg-muted text-xs ml-1.5">({pct(claim.percentage)})</span>
                )}
                {claim.notes && <span className="text-fg-muted text-xs ml-1.5">· {claim.notes}</span>}
              </span>

              {/* Status toggles */}
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={!isAdmin || isPending || claim.invoiced}
                  onClick={() => optimisticToggle(claim.id, 'pendingReview', claim.pendingReview, toggleProgressClaimPendingReview, 'value')}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                    claim.pendingReview
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'text-fg-muted hover:bg-surface-raised'
                  }`}
                >
                  {claim.pendingReview ? 'Pending' : '—'}
                </button>
                <button
                  type="button"
                  disabled={!isAdmin || isPending || claim.invoiced}
                  onClick={() => optimisticToggle(claim.id, 'approvedForInvoicing', claim.approvedForInvoicing, toggleProgressClaimApprovedForInvoicing, 'value')}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-40 ${
                    claim.approvedForInvoicing
                      ? 'bg-accent-dim text-accent-fg'
                      : 'text-fg-muted hover:bg-surface-raised'
                  }`}
                >
                  {claim.approvedForInvoicing ? 'Approved' : '—'}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => optimisticToggle(claim.id, 'invoiced', claim.invoiced, toggleProgressClaimInvoiced, 'value')}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-60 ${
                    claim.invoiced
                      ? 'bg-accent-dim text-accent-fg'
                      : 'bg-surface-raised text-fg-muted hover:bg-border'
                  }`}
                >
                  {claim.invoiced ? 'Invoiced' : 'Invoice'}
                </button>
                {isAdmin && !claim.invoiced && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(claim.id)}
                    className="text-xs text-fg-muted hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Running total footer */}
      <div className="rounded-xl border border-border bg-surface-raised px-4 py-2.5 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        <span className="text-fg-muted">
          Claimed: <span className="font-semibold text-fg tabular-nums">{fmt(claimedTotal)}</span>
          {totalContractValue > 0 && <span className="text-fg-muted"> of {fmt(totalContractValue)} ({pct(claimedPct)})</span>}
        </span>
        <span className="text-fg-muted">
          Invoiced: <span className="font-semibold text-fg tabular-nums">{fmt(invoicedTotal)}</span>
        </span>
        {totalContractValue > 0 && (
          <span className="text-fg-muted">
            Remaining: <span className={`font-semibold tabular-nums ${remaining >= 0 ? 'text-fg' : 'text-red-600 dark:text-red-400'}`}>{fmt(remaining)}</span>
          </span>
        )}
      </div>

      {actionError && <p className="text-xs text-red-600 dark:text-red-400">{actionError}</p>}

      {isAdmin && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs font-medium text-accent-fg hover:text-green-800 transition-colors"
        >
          + New progress claim
        </button>
      )}

      {isAdmin && showForm && (
        <NewClaimForm
          stageId={stageId}
          totalContractValue={totalContractValue}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
