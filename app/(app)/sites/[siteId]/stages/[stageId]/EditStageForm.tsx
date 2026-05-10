'use client'

import { useActionState, useState } from 'react'
import { updateStage, deleteStage } from './actions'
import type { ActionState, EditState } from '@/types/actions'

interface Props {
  siteId: string
  stageId: string
  name: string
  isAdmin?: boolean
}

export default function EditStageForm({ siteId, stageId, name, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [state, action, pending] = useActionState<EditState, FormData>(updateStage, null)
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteStage, null)

  if (!open || state?.success) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
      >
        Edit
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <form action={action} className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="site_id"  value={siteId} />
        <input type="hidden" name="stage_id" value={stageId} />
        <input
          name="name"
          type="text"
          required
          defaultValue={name}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 w-44"
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
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 shrink-0"
        >
          Cancel
        </button>
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
              <p className="text-xs text-stone-600">Delete this stage and all its lots?</p>
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
                className="text-xs text-stone-500 hover:text-stone-700"
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
