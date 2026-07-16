'use client'

import { useState, useActionState, useTransition } from 'react'
import { addSubcontractorCost, updateSubcontractorCost, deleteSubcontractorCost } from './subcontractor-actions'
import type { ActionState } from '@/types/actions'

export type SubcontractorCostRow = {
  id: string
  trade: string
  trade_label: string | null
  invoice_amount: number
  invoice_date: string | null
  notes: string | null
}

const TRADES = ['Paving', 'Fencing', 'Other'] as const

function fmt(n: number) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Inline row form (shared by Add and Edit) ──────────────────────────────────

function CostForm({
  lotId, siteId, stageId,
  initial,
  action,
  onCancel,
}: {
  lotId: string; siteId: string; stageId: string
  initial?: SubcontractorCostRow
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null)
  const [trade, setTrade] = useState<string>(initial?.trade ?? 'Paving')

  return (
    <form action={formAction} className="space-y-3 p-4 bg-surface-raised rounded-xl border border-border">
      <input type="hidden" name="lot_id"   value={lotId} />
      <input type="hidden" name="site_id"  value={siteId} />
      <input type="hidden" name="stage_id" value={stageId} />
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Trade</label>
          <select
            name="trade"
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          >
            {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {trade === 'Other' && (
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Label</label>
            <input
              type="text"
              name="trade_label"
              defaultValue={initial?.trade_label ?? ''}
              placeholder="e.g. Concreting"
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Invoice amount <span className="text-red-500">*</span></label>
          <input
            type="number"
            name="invoice_amount"
            defaultValue={initial?.invoice_amount ?? ''}
            min="0.01"
            step="0.01"
            required
            placeholder="0.00"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">Invoice date</label>
          <input
            type="date"
            name="invoice_date"
            defaultValue={initial?.invoice_date ?? ''}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">Notes</label>
        <input
          type="text"
          name="notes"
          defaultValue={initial?.notes ?? ''}
          placeholder="Optional notes"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>

      {state?.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : (initial ? 'Save changes' : 'Add cost')}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-fg-muted hover:text-fg-secondary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SubcontractorCosts({
  lotId, siteId, stageId,
  initialCosts,
  contractPrice,
  isAdmin,
}: {
  lotId: string
  siteId: string
  stageId: string
  initialCosts: SubcontractorCostRow[]
  contractPrice: number
  isAdmin: boolean
}) {
  const [open, setOpen]         = useState(false)
  const [showAdd, setShowAdd]   = useState(false)
  const [editingId, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [, startTransition]     = useTransition()

  const total  = initialCosts.reduce((s, c) => s + Number(c.invoice_amount), 0)
  const margin = contractPrice - total

  function handleDelete(id: string) {
    setDeleting(id)
    setDeleteError(null)
    const fd = new FormData()
    fd.set('id', id)
    fd.set('lot_id', lotId)
    fd.set('site_id', siteId)
    fd.set('stage_id', stageId)
    startTransition(async () => {
      const result = await deleteSubcontractorCost(null, fd)
      if (result?.error) setDeleteError(result.error)
      setDeleting(null)
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-raised transition-colors"
      >
        <svg className={`h-4 w-4 text-fg-muted shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        <span className="text-sm font-semibold text-fg flex-1">Subcontractor Costs</span>
        {initialCosts.length > 0 && (
          <span className="text-xs text-fg-muted shrink-0">{initialCosts.length} entr{initialCosts.length !== 1 ? 'ies' : 'y'} · {fmt(total)}</span>
        )}
      </button>

      {open && (
        <div className="border-t border-border-subtle px-5 pb-5 space-y-3 pt-4">

          {initialCosts.length > 0 && (
            <div className="divide-y divide-border-subtle rounded-xl border border-border overflow-hidden">
              {initialCosts.map((cost) => {
                const label = cost.trade === 'Other' ? (cost.trade_label ?? 'Other') : cost.trade
                return (
                  <div key={cost.id}>
                    {editingId === cost.id ? (
                      <div className="p-3">
                        <CostForm
                          lotId={lotId} siteId={siteId} stageId={stageId}
                          initial={cost}
                          action={updateSubcontractorCost}
                          onCancel={() => setEditing(null)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-fg">{label}</p>
                          <p className="text-xs text-fg-muted">
                            {fmt(Number(cost.invoice_amount))}
                            {cost.invoice_date && ` · ${fmtDate(cost.invoice_date)}`}
                            {cost.notes && ` · ${cost.notes}`}
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => { setEditing(cost.id); setShowAdd(false) }}
                              className="text-xs text-fg-muted hover:text-fg-secondary transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(cost.id)}
                              disabled={deleting === cost.id}
                              className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deleting === cost.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {deleteError && <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>}

          {isAdmin && !showAdd && editingId === null && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-xs font-medium text-accent-fg hover:text-green-800 transition-colors"
            >
              + Add entry
            </button>
          )}

          {isAdmin && showAdd && (
            <CostForm
              lotId={lotId} siteId={siteId} stageId={stageId}
              action={addSubcontractorCost}
              onCancel={() => setShowAdd(false)}
            />
          )}

          {/* Footer totals */}
          {initialCosts.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-fg-muted">Total subcontractor costs</span>
                <span className="font-medium text-fg tabular-nums">{fmt(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-fg-muted">Contract price</span>
                <span className="font-medium text-fg tabular-nums">{fmt(contractPrice)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border-subtle pt-1.5">
                <span className="font-semibold text-fg-secondary">Margin</span>
                <span className={`font-bold tabular-nums ${margin >= 0 ? 'text-accent-fg' : 'text-red-600 dark:text-red-400'}`}>
                  {fmt(margin)}
                </span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
