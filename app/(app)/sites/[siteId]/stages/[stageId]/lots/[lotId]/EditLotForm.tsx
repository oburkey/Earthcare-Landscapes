'use client'

import { useActionState } from 'react'
import { updateLot } from './actions'
import { STATUS_OPTIONS } from '@/lib/lotStatus'
import type { LotStatus } from '@/types/database'

type ActionState = { error: string } | null

interface Props {
  lotId: string
  siteId: string
  stageId: string
  currentStatus: LotStatus
  currentNotes: string | null
  currentDueDate: string | null
  currentScheduledDate: string | null
  canManage: boolean
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
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateLot,
    null
  )

  return (
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
  )
}
