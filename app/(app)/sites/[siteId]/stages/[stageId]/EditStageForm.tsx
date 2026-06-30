'use client'

import { useActionState, useState } from 'react'
import { updateStage, deleteStage } from './actions'
import type { ActionState, EditState } from '@/types/actions'

interface Props {
  siteId: string
  stageId: string
  name: string
  isAdmin?: boolean
  isContractPricing?: boolean
  defaultContractPrice?: number | null
}

export default function EditStageForm({ siteId, stageId, name, isAdmin, isContractPricing = false, defaultContractPrice }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [contractPricing, setContractPricing] = useState(isContractPricing)
  const [state, action, pending] = useActionState<EditState, FormData>(updateStage, null)
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteStage, null)

  if (!open || state?.success) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-secondary hover:bg-surface-raised"
      >
        Edit
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <form action={action} className="space-y-3">
        <input type="hidden" name="site_id"  value={siteId} />
        <input type="hidden" name="stage_id" value={stageId} />
        <input type="hidden" name="is_contract_pricing" value={contractPricing ? 'true' : 'false'} />

        <div className="flex items-center gap-2 flex-wrap">
          <input
            name="name"
            type="text"
            required
            defaultValue={name}
            className="rounded-lg border border-border px-3 py-1.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 w-44 bg-surface text-fg"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 shrink-0"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-raised shrink-0"
          >
            Cancel
          </button>
        </div>

        {/* Contract pricing toggle */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-fg-muted">Contract pricing</span>
            <button
              type="button"
              onClick={() => setContractPricing((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                contractPricing ? 'bg-accent-dim text-accent-fg' : 'bg-surface-raised text-fg-muted'
              }`}
            >
              {contractPricing ? 'On' : 'Off'}
            </button>
          </div>
          {contractPricing && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-fg-muted shrink-0">Default price per lot</label>
              <div className="relative w-36">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-fg-muted">$</span>
                <input
                  name="default_contract_price"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={defaultContractPrice ?? ''}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border pl-6 pr-3 py-1.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-surface text-fg"
                />
              </div>
            </div>
          )}
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 w-full">{state.error}</p>
        )}
      </form>

      {isAdmin && (
        <div>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Delete stage
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-fg-secondary">Delete this stage and all its lots?</p>
              <form action={deleteAction}>
                <input type="hidden" name="site_id"  value={siteId} />
                <input type="hidden" name="stage_id" value={stageId} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletePending ? 'Deleting…' : 'Yes, delete'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-fg-muted hover:text-fg-secondary"
              >
                Cancel
              </button>
              {deleteState?.error && (
                <p className="text-xs text-red-600 w-full">{deleteState.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
