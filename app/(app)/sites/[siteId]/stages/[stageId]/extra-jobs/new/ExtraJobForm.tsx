'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createExtraJob } from './actions'

type ActionState = { error: string } | null

interface Props {
  stageId: string
  siteId: string
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete',    label: 'Complete' },
]

export default function ExtraJobForm({ stageId, siteId }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createExtraJob,
    null
  )

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="stage_id" value={stageId} />
      <input type="hidden" name="site_id"  value={siteId} />

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-stone-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Clean up drainage channel"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          placeholder="Brief description of the work…"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
        />
      </div>

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
          {STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Any relevant notes…"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Add extra job'}
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
