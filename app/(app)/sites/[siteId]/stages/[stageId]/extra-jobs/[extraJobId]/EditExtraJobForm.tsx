'use client'

import { useActionState, useState } from 'react'
import { updateExtraJob, deleteExtraJob } from './actions'
import type { ExtraJobStatus } from '@/types/database'
import type { ActionState } from '@/types/actions'
import { EXTRA_JOB_STATUS_OPTIONS } from '@/lib/lotStatus'

interface Props {
  extraJobId: string
  siteId: string
  stageId: string
  currentTitle: string
  currentDescription: string | null
  currentStatus: ExtraJobStatus
  currentNotes: string | null
  currentDueDate: string | null
  canManage: boolean
  isAdmin?: boolean
}


export default function EditExtraJobForm({
  extraJobId,
  siteId,
  stageId,
  currentTitle,
  currentDescription,
  currentStatus,
  currentNotes,
  currentDueDate,
  canManage,
  isAdmin,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateExtraJob,
    null
  )
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(
    deleteExtraJob,
    null
  )

  return (
    <>
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
          {EXTRA_JOB_STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {canManage && (
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
      )}

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

    {isAdmin && (
      <div className="mt-4 pt-3 border-t border-stone-100">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete extra job
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-stone-700">
              Permanently delete this extra job and all its photos and pricing data?
            </p>
            <div className="flex items-center gap-3">
              <form action={deleteAction}>
                <input type="hidden" name="extra_job_id" value={extraJobId} />
                <input type="hidden" name="site_id"      value={siteId} />
                <input type="hidden" name="stage_id"     value={stageId} />
                <button
                  type="submit"
                  disabled={deletePending}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletePending ? 'Deleting…' : 'Yes, delete'}
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
    </>
  )
}
