'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createLot } from './actions'
import { STATUS_OPTIONS } from '@/lib/lotStatus'

type ActionState = { error: string } | null

interface Props {
  stageId: string
  siteId: string
}

export default function LotForm({ stageId, siteId }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createLot,
    null
  )

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="stage_id" value={stageId} />
      <input type="hidden" name="site_id" value={siteId} />

      {/* Lot number */}
      <div>
        <label htmlFor="lot_number" className="block text-sm font-medium text-stone-700">
          Lot number <span className="text-red-500">*</span>
        </label>
        <input
          id="lot_number"
          name="lot_number"
          type="text"
          required
          placeholder="e.g. 14, 14A, 14B"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>

      {/* Status */}
      <div>
        <label htmlFor="status" className="block text-sm font-medium text-stone-700">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue="not_started"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 bg-white"
        >
          {STATUS_OPTIONS.map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-stone-700">
            Due date
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
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
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Any relevant notes for this lot…"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Add lot'}
        </button>
        <Link
          href={`/sites/${siteId}/stages/${stageId}`}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
