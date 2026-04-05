'use client'

import { useActionState } from 'react'
import { updateExtraJob } from './actions'
import type { ExtraJobStatus } from '@/types/database'

type ActionState = { error: string } | null

interface Props {
  extraJobId: string
  siteId: string
  stageId: string
  currentTitle: string
  currentDescription: string | null
  currentStatus: ExtraJobStatus
  currentNotes: string | null
  canManage: boolean
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete',    label: 'Complete' },
]

export default function EditExtraJobForm({
  extraJobId,
  siteId,
  stageId,
  currentTitle,
  currentDescription,
  currentStatus,
  currentNotes,
  canManage,
}: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateExtraJob,
    null
  )

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="extra_job_id" value={extraJobId} />
      <input type="hidden" name="site_id"      value={siteId} />
      <input type="hidden" name="stage_id"     value={stageId} />

      {canManage && (
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-stone-700">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={currentTitle}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>
      )}

      {canManage && (
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-stone-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            defaultValue={currentDescription ?? ''}
            placeholder="Brief description of the work…"
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
          />
        </div>
      )}

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
          rows={4}
          defaultValue={currentNotes ?? ''}
          placeholder="Add notes about this job…"
          className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 resize-none"
        />
      </div>

      {/* Hidden fields for canManage=false (workers update status+notes only, title/description unchanged) */}
      {!canManage && (
        <>
          <input type="hidden" name="title"       value={currentTitle} />
          <input type="hidden" name="description" value={currentDescription ?? ''} />
        </>
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
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
