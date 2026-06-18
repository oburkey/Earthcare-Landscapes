'use client'

import { useActionState, useState } from 'react'
import { updateLot, deleteLot } from './actions'
import { STATUS_OPTIONS } from '@/lib/lotStatus'
import type { LotStatus } from '@/types/database'
import type { ActionState } from '@/types/actions'

type UpdateState = { error: string } | null

interface Props {
  lotId: string
  siteId: string
  stageId: string
  currentStatus: LotStatus
  currentNotes: string | null
  currentDueDate: string | null
  currentScheduledDate: string | null
  canManage: boolean
  isAdmin?: boolean
  isContractPricing?: boolean
  contractPrice?: number | null
  defaultContractPrice?: number | null
}

export default function EditLotForm({
  lotId,
  siteId,
  stageId,
  currentStatus,
  currentNotes,
  currentDueDate,
  currentScheduledDate,
  canManage,
  isAdmin,
  isContractPricing,
  contractPrice,
  defaultContractPrice,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [state, action, pending] = useActionState<UpdateState, FormData>(updateLot, null)
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteLot, null)

  return (
    <div className="space-y-4">
    <form action={action} className="space-y-4">
      <input type="hidden" name="lot_id" value={lotId} />
      <input type="hidden" name="site_id" value={siteId} />
      <input type="hidden" name="stage_id" value={stageId} />

      {/* Status — all roles */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-stone-700">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={currentStatus}
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-white"
        >
          {STATUS_OPTIONS.map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Notes — all roles */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={currentNotes ?? ''}
          placeholder="Add notes about this lot…"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
        />
      </div>

      {/* Date fields — supervisor/admin only */}
      {canManage && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="due_date" className="block text-sm font-medium text-stone-700">
              Due date
            </label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={currentDueDate ?? ''}
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <div>
            <label htmlFor="scheduled_date" className="block text-sm font-medium text-stone-700">
              Scheduled date
            </label>
            <input
              id="scheduled_date"
              name="scheduled_date"
              type="date"
              defaultValue={currentScheduledDate ?? ''}
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
        </div>
      )}

      {/* Contract price — only when stage has contract pricing enabled */}
      {isContractPricing && canManage && (
        <div>
          <label htmlFor="contract_price" className="block text-sm font-medium text-stone-700">
            Contract price
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">$</span>
            <input
              id="contract_price"
              name="contract_price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={contractPrice ?? defaultContractPrice ?? ''}
              placeholder="0.00"
              className="block w-full rounded-lg border border-stone-300 pl-7 pr-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
            />
          </div>
          <p className="mt-1 text-xs text-stone-400">
            Fixed price for this lot (overrides quant sheet total)
          </p>
        </div>
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </form>

    {isAdmin && (
      <div className="mt-4 pt-3 border-t border-stone-100">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete lot
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-stone-700">
              Permanently delete this lot and all its photos, documents, and quantities?
            </p>
            <div className="flex items-center gap-3">
              <form action={deleteAction}>
                <input type="hidden" name="lot_id"   value={lotId} />
                <input type="hidden" name="site_id"  value={siteId} />
                <input type="hidden" name="stage_id" value={stageId} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletePending ? 'Deleting…' : 'Yes, delete lot'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-stone-500 hover:text-stone-700"
              >
                Cancel
              </button>
            </div>
            {deleteState?.error && (
              <p className="text-sm text-red-600">{deleteState.error}</p>
            )}
          </div>
        )}
      </div>
    )}
    </div>
  )
}
